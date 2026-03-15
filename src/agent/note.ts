import { USER_AGENT } from "./crawl";
import type { FeedArticle } from "./types";

export interface NoteApiResponse {
	data: {
		category_id: number | null;
		first_page: boolean;
		next_page: number | null;
		last_page: boolean;
		notes: {
			id: number;
			name: string;
			body: string;
			note_url: string;
			publish_at: string;
			like_count: number;
			user: { urlname: string; nickname: string };
		}[];
	};
}

const GAME_KEYWORDS = [
	/apex/i,
	/fortnite/i,
	/フォートナイト/,
	/スプラトゥーン/,
	/原神/,
	/reasnow/i,
	/コンバーター/,
	/eスポーツ/,
	/ゲーム攻略/,
	/攻略法/,
	/攻略ガイド/,
	/\bPS[45]\b/,
	/\bNintendo\b/i,
	/ゲーム.?選$/,
];

export function isGameRelated(title: string): boolean {
	return GAME_KEYWORDS.some((pattern) => pattern.test(title));
}

export function parseNoteApiResponse(response: NoteApiResponse): FeedArticle[] {
	return response.data.notes
		.filter((note) => !isGameRelated(note.name))
		.map((note) => ({
			url: note.note_url,
			title: note.name,
			description: (note.body ?? "").slice(0, 200),
			publishedAt: note.publish_at,
			metadata: {
				like_count: note.like_count,
				author: note.user.nickname,
			},
		}));
}

const DEFAULT_MAX_PAGES = 10;

interface FetchNoteOptions {
	maxAgeDays?: number;
	maxPages?: number;
	fetchFn?: typeof fetch;
	now?: Date;
}

export async function fetchNoteArticles(
	apiUrl: string,
	options: FetchNoteOptions = {},
): Promise<FeedArticle[]> {
	const {
		maxAgeDays = 1,
		maxPages = DEFAULT_MAX_PAGES,
		fetchFn = fetch,
		now = new Date(),
	} = options;

	const cutoff = new Date(now.getTime() - maxAgeDays * 24 * 60 * 60 * 1000);
	const allArticles: FeedArticle[] = [];

	const separator = apiUrl.includes("?") ? "&" : "?";

	for (let page = 1; page <= maxPages; page++) {
		const url = `${apiUrl}${separator}page=${page}`;

		console.log(`[note] fetching page ${page}: ${url}`);

		try {
			const res = await fetchFn(url, {
				headers: { "User-Agent": USER_AGENT },
			});
			if (!res.ok) {
				console.log(`[note] fetch failed: ${url} (HTTP ${res.status})`);
				return allArticles;
			}

			const json = (await res.json()) as NoteApiResponse;
			const articles = parseNoteApiResponse(json);

			// 日付フィルタ: cutoff以降の記事のみ
			let hasOldArticle = false;
			for (const article of articles) {
				if (new Date(article.publishedAt) >= cutoff) {
					allArticles.push(article);
				} else {
					hasOldArticle = true;
				}
			}

			// 古い記事が出たか、最終ページならば終了
			if (
				hasOldArticle ||
				json.data.last_page ||
				json.data.next_page === null
			) {
				break;
			}
		} catch (e) {
			console.log(`[note] fetch error: ${url} (${e})`);
			return allArticles;
		}
	}

	console.log(`[note] total: ${allArticles.length} articles`);
	return allArticles;
}
