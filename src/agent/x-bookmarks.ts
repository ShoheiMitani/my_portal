import { filterAndStoreArticles } from "./crawl";
import type { Channel, Env, FeedArticle } from "./types";

const BOOKMARK_MAX_AGE_DAYS = 3;

// X API のURL除外パターン
const EXCLUDED_URL_PATTERNS = [
	/^https?:\/\/(www\.)?x\.com\//,
	/^https?:\/\/(www\.)?twitter\.com\//,
	/^https?:\/\/pic\.twitter\.com\//,
];

interface BookmarkUrl {
	expanded_url: string;
	url: string;
}

interface BookmarkTweet {
	id: string;
	text: string;
	created_at?: string;
	entities?: {
		urls?: BookmarkUrl[];
	};
}

interface BookmarksResponse {
	data?: BookmarkTweet[];
	meta?: {
		next_token?: string;
	};
}

interface TokenResponse {
	access_token: string;
	refresh_token: string;
	expires_in: number;
	token_type: string;
}

interface BookmarkArticle {
	url: string;
	publishedAt: string;
}

/**
 * ブックマークレスポンスから記事URLを抽出する（X/Twitter自体のURLは除外）
 */
export function extractUrlsFromBookmarks(
	bookmarks: BookmarksResponse,
): BookmarkArticle[] {
	if (!bookmarks.data || bookmarks.data.length === 0) return [];

	const articles: BookmarkArticle[] = [];
	for (const tweet of bookmarks.data) {
		if (!tweet.entities?.urls) continue;
		const publishedAt = tweet.created_at ?? new Date().toISOString();
		for (const urlEntity of tweet.entities.urls) {
			const expanded = urlEntity.expanded_url;
			const isExcluded = EXCLUDED_URL_PATTERNS.some((pattern) =>
				pattern.test(expanded),
			);
			if (!isExcluded) {
				articles.push({ url: expanded, publishedAt });
			}
		}
	}
	return articles;
}

async function requestXToken(
	body: URLSearchParams,
	clientId: string,
	clientSecret: string,
): Promise<TokenResponse> {
	const res = await fetch("https://api.x.com/2/oauth2/token", {
		method: "POST",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
			Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
		},
		body: body.toString(),
	});
	if (!res.ok) {
		const errorBody = await res.text();
		throw new Error(
			`X OAuth token request failed (HTTP ${res.status}): ${errorBody}`,
		);
	}
	return res.json() as Promise<TokenResponse>;
}

async function refreshAccessToken(
	refreshToken: string,
	clientId: string,
	clientSecret: string,
): Promise<TokenResponse> {
	return requestXToken(
		new URLSearchParams({
			grant_type: "refresh_token",
			refresh_token: refreshToken,
		}),
		clientId,
		clientSecret,
	);
}

export async function fetchBookmarks(
	accessToken: string,
	userId: string,
	paginationToken?: string,
): Promise<BookmarksResponse> {
	const params = new URLSearchParams({
		"tweet.fields": "entities,created_at",
		max_results: "100",
	});
	if (paginationToken) {
		params.set("pagination_token", paginationToken);
	}

	const res = await fetch(
		`https://api.x.com/2/users/${userId}/bookmarks?${params.toString()}`,
		{
			headers: {
				Authorization: `Bearer ${accessToken}`,
			},
		},
	);

	if (!res.ok) {
		throw new Error(
			`X Bookmarks API failed (HTTP ${res.status}): ${await res.text()}`,
		);
	}

	return res.json() as Promise<BookmarksResponse>;
}

async function getStoredTokens(db: D1Database): Promise<{
	access_token: string;
	refresh_token: string;
	expires_at: string;
} | null> {
	return db
		.prepare(
			"SELECT access_token, refresh_token, expires_at FROM oauth_tokens WHERE provider = 'x' LIMIT 1",
		)
		.first();
}

async function storeTokens(
	db: D1Database,
	tokens: TokenResponse,
): Promise<void> {
	const expiresAt = new Date(
		Date.now() + tokens.expires_in * 1000,
	).toISOString();

	await db
		.prepare(
			`INSERT INTO oauth_tokens (id, provider, access_token, refresh_token, expires_at)
			 VALUES ('x_oauth', 'x', ?, ?, ?)
			 ON CONFLICT(id) DO UPDATE SET
			   access_token = excluded.access_token,
			   refresh_token = excluded.refresh_token,
			   expires_at = excluded.expires_at,
			   updated_at = datetime('now')`,
		)
		.bind(tokens.access_token, tokens.refresh_token, expiresAt)
		.run();
}

/**
 * 有効なアクセストークンを取得する（期限切れなら自動リフレッシュ）
 */
async function getValidAccessToken(
	db: D1Database,
	clientId: string,
	clientSecret: string,
): Promise<string | null> {
	const stored = await getStoredTokens(db);
	if (!stored) return null;

	const now = new Date();
	const expiresAt = new Date(stored.expires_at);

	// 5分の余裕を持って期限切れ判定
	if (expiresAt.getTime() - now.getTime() > 5 * 60 * 1000) {
		return stored.access_token;
	}

	console.log("[x-bookmarks] refreshing access token...");
	const newTokens = await refreshAccessToken(
		stored.refresh_token,
		clientId,
		clientSecret,
	);
	await storeTokens(db, newTokens);
	return newTokens.access_token;
}

export async function processXBookmarks(
	db: D1Database,
	env: Env,
): Promise<{ articlesFound: number; articlesNew: number }> {
	const accessToken = await getValidAccessToken(
		db,
		env.X_CLIENT_ID,
		env.X_CLIENT_SECRET,
	);
	if (!accessToken) {
		console.log("[x-bookmarks] no valid token found, skipping");
		return { articlesFound: 0, articlesNew: 0 };
	}

	const channel = await db
		.prepare(
			"SELECT id, slug, name, channel_type, config FROM channels WHERE slug = 'x_bookmarks'",
		)
		.first<Channel>();

	if (!channel) {
		console.log("[x-bookmarks] x_bookmarks channel not found");
		return { articlesFound: 0, articlesNew: 0 };
	}

	const config = JSON.parse(channel.config) as { content_type?: string };

	const allItems: BookmarkArticle[] = [];
	let paginationToken: string | undefined;
	const cutoff = new Date(
		Date.now() - BOOKMARK_MAX_AGE_DAYS * 24 * 60 * 60 * 1000,
	);
	let reachedOldTweets = false;

	for (let page = 0; page < 5; page++) {
		const bookmarks = await fetchBookmarks(
			accessToken,
			env.X_USER_ID,
			paginationToken,
		);
		const items = extractUrlsFromBookmarks(bookmarks);

		for (const item of items) {
			if (new Date(item.publishedAt) < cutoff) {
				reachedOldTweets = true;
				continue;
			}
			allItems.push(item);
		}

		if (reachedOldTweets) break;
		paginationToken = bookmarks.meta?.next_token;
		if (!paginationToken) break;
	}

	console.log(
		`[x-bookmarks] extracted ${allItems.length} URLs from bookmarks (within ${BOOKMARK_MAX_AGE_DAYS} days)`,
	);

	const seen = new Set<string>();
	const articles: FeedArticle[] = [];
	for (const item of allItems) {
		if (seen.has(item.url)) continue;
		seen.add(item.url);
		articles.push({
			url: item.url,
			title: item.url,
			description: "",
			publishedAt: item.publishedAt,
			metadata: { source: "x_bookmarks" },
		});
	}

	return filterAndStoreArticles(db, channel, articles, config);
}
