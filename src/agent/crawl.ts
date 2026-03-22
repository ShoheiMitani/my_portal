import html2md from "html-to-md";
import { fetchFeed } from "./feed";
import { fetchNoteArticles } from "./note";
import type { ArticleWithContent, Channel, Env, FeedArticle } from "./types";
import { processXBookmarks } from "./x-bookmarks";

export const USER_AGENT = "Mozilla/5.0 (compatible; TrendCollectorBot/1.0)";

interface ChannelConfig {
	feed_url?: string;
	api_url?: string;
	content_type?: string;
}

function parseChannelConfig(channel: Channel): ChannelConfig {
	return JSON.parse(channel.config) as ChannelConfig;
}

/**
 * 記事をDBに保存し、収集実行を記録する
 */
export async function collectFeedArticles(
	db: D1Database,
	channel: Channel,
	articles: ArticleWithContent[],
	config?: ChannelConfig,
) {
	if (articles.length === 0) return { articlesFound: 0, articlesNew: 0 };

	const contentType =
		(config ?? parseChannelConfig(channel)).content_type ?? "blog";
	const runId = crypto.randomUUID();

	const insertStmts = articles.map((article) =>
		db
			.prepare(
				"INSERT OR IGNORE INTO articles (id, url, title, description, content, content_type, published_at, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
			)
			.bind(
				crypto.randomUUID(),
				article.url,
				article.title,
				article.description,
				article.content,
				contentType,
				article.publishedAt,
				JSON.stringify(article.metadata),
			),
	);

	const results = await db.batch(insertStmts);
	const newCount = results.reduce((sum, r) => sum + (r.meta.changes ?? 0), 0);

	await db
		.prepare(
			"INSERT INTO collection_runs (id, channel_id, articles_found, articles_new) VALUES (?, ?, ?, ?)",
		)
		.bind(runId, channel.id, articles.length, newCount)
		.run();

	const linkStmts = articles.map((article) =>
		db
			.prepare(
				`INSERT OR IGNORE INTO collection_items (id, article_id, collection_run_id)
				 SELECT ?, a.id, ?
				 FROM articles a WHERE a.url = ?`,
			)
			.bind(crypto.randomUUID(), runId, article.url),
	);

	await db.batch(linkStmts);

	return { articlesFound: articles.length, articlesNew: newCount };
}

/**
 * 記事URLからHTMLを取得し、本文をmarkdownに変換する
 */
const HTML_ENTITIES: Record<string, string> = {
	"&amp;": "&",
	"&lt;": "<",
	"&gt;": ">",
	"&quot;": '"',
	"&#39;": "'",
	"&apos;": "'",
};

function decodeHtmlEntities(text: string): string {
	return text.replace(
		/&(?:amp|lt|gt|quot|#39|apos);/g,
		(m) => HTML_ENTITIES[m] ?? m,
	);
}

function extractTitle(html: string): string {
	const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
	return match ? decodeHtmlEntities(match[1].trim()) : "";
}

async function fetchArticleContent(
	url: string,
	resolveTitle = false,
): Promise<{ content: string; title: string }> {
	try {
		const res = await fetch(url, {
			headers: { "User-Agent": USER_AGENT },
		});
		if (!res.ok) {
			console.log(`[crawl] fetch failed: ${url} (HTTP ${res.status})`);
			return { content: "", title: "" };
		}
		const html = await res.text();
		return {
			content: html2md(html),
			title: resolveTitle ? extractTitle(html) : "",
		};
	} catch (e) {
		console.log(`[crawl] fetch error: ${url} (${e})`);
		return { content: "", title: "" };
	}
}

const CONCURRENCY_LIMIT = 5;
const FEED_MAX_AGE_DAYS = 30;
const NOTE_API_MAX_AGE_DAYS = 1;

async function mapWithConcurrency<T, R>(
	items: T[],
	fn: (item: T) => Promise<R>,
	limit: number,
): Promise<R[]> {
	const results: R[] = new Array(items.length);
	let index = 0;
	async function worker() {
		while (index < items.length) {
			const i = index++;
			results[i] = await fn(items[i]);
		}
	}
	await Promise.all(
		Array.from({ length: Math.min(limit, items.length) }, worker),
	);
	return results;
}

/**
 * 記事リストからDB未登録分を抽出し、本文取得してDBに保存する共通処理
 */
export async function filterAndStoreArticles(
	db: D1Database,
	channel: Channel,
	articles: FeedArticle[],
	config: ChannelConfig,
) {
	if (articles.length === 0) return { articlesFound: 0, articlesNew: 0 };

	// DB に既に存在するURLを取得してスキップ
	const urls = articles.map((a) => a.url);
	const placeholders = urls.map(() => "?").join(",");
	const { results: existingRows } = await db
		.prepare(`SELECT url FROM articles WHERE url IN (${placeholders})`)
		.bind(...urls)
		.all<{ url: string }>();
	const existingUrls = new Set(existingRows.map((r) => r.url));

	const newArticles = articles.filter((a) => !existingUrls.has(a.url));
	console.log(
		`[crawl] ${channel.name}: ${newArticles.length} new, ${existingUrls.size} skipped`,
	);

	let done = 0;
	const articlesWithContent = await mapWithConcurrency(
		newArticles,
		async (article) => {
			const needsTitle = article.title === article.url;
			const { content, title } = await fetchArticleContent(
				article.url,
				needsTitle,
			);
			done++;
			const resolvedTitle = title || article.title;
			console.log(
				`[crawl] ${channel.name}: content ${done}/${newArticles.length} - ${resolvedTitle}`,
			);
			return { ...article, title: resolvedTitle, content };
		},
		CONCURRENCY_LIMIT,
	);

	const result = await collectFeedArticles(
		db,
		channel,
		articlesWithContent,
		config,
	);
	console.log(
		`[crawl] ${channel.name}: done (found=${result.articlesFound}, new=${result.articlesNew})`,
	);
	return result;
}

/**
 * 単一チャネルをクロールする
 */
export async function crawlChannel(db: D1Database, channel: Channel) {
	const config = parseChannelConfig(channel);

	if (channel.channel_type === "note_api") {
		if (!config.api_url) return { articlesFound: 0, articlesNew: 0 };
		console.log(`[crawl] ${channel.name}: fetching note API...`);
		const articles = await fetchNoteArticles(config.api_url, {
			maxAgeDays: NOTE_API_MAX_AGE_DAYS,
		});
		console.log(`[crawl] ${channel.name}: ${articles.length} from API`);
		return filterAndStoreArticles(db, channel, articles, config);
	}

	if (!config.feed_url) return { articlesFound: 0, articlesNew: 0 };
	console.log(`[crawl] ${channel.name}: fetching feed...`);
	const allArticles = await fetchFeed(config.feed_url);

	const cutoff = new Date(Date.now() - FEED_MAX_AGE_DAYS * 24 * 60 * 60 * 1000);
	const articles = allArticles.filter((a) => {
		if (!a.publishedAt) return true;
		return new Date(a.publishedAt) >= cutoff;
	});
	console.log(
		`[crawl] ${channel.name}: ${allArticles.length} in feed, ${articles.length} within ${FEED_MAX_AGE_DAYS} days`,
	);
	return filterAndStoreArticles(db, channel, articles, config);
}

/**
 * 全フィードチャネルをクロールする（cron用）
 */
export async function crawlAllChannels(db: D1Database, env?: Env) {
	const { results: channels } = await db
		.prepare(
			"SELECT id, slug, name, channel_type, config FROM channels WHERE channel_type IN ('rss', 'atom', 'note_api')",
		)
		.all<Channel>();

	const includeXBookmarks = !!(
		env?.X_CLIENT_ID &&
		env?.X_CLIENT_SECRET &&
		env?.X_USER_ID
	);
	console.log(
		`[crawl] starting: ${channels.length} channels${includeXBookmarks ? " + x_bookmarks" : ""}`,
	);

	type CrawlTask = {
		slug: string;
		promise: Promise<{ articlesFound: number; articlesNew: number }>;
	};
	const tasks: CrawlTask[] = channels.map((ch) => ({
		slug: ch.slug,
		promise: crawlChannel(db, ch),
	}));
	if (includeXBookmarks && env) {
		tasks.push({ slug: "x_bookmarks", promise: processXBookmarks(db, env) });
	}

	const settled = await Promise.allSettled(tasks.map((t) => t.promise));
	const results = tasks.map((task, i) => {
		const outcome = settled[i];
		if (outcome.status === "rejected") {
			console.log(`[crawl] ${task.slug}: FAILED (${outcome.reason})`);
		}
		const result =
			outcome.status === "fulfilled"
				? outcome.value
				: { articlesFound: 0, articlesNew: 0 };
		return { channel: task.slug, ...result };
	});

	console.log("[crawl] all channels done");
	return results;
}
