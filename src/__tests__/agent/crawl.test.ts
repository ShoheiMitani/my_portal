import { describe, expect, it, vi } from "vitest";
import {
	collectFeedArticles,
	crawlAllChannels,
	crawlChannel,
} from "../../agent/crawl";
import type { ArticleWithContent, Channel } from "../../agent/types";

function createMockDb() {
	const preparedStmts: { sql: string; binds: unknown[] }[] = [];

	const db = {
		prepare: (sql: string) => {
			const stmt = {
				bind: (...args: unknown[]) => {
					preparedStmts.push({ sql, binds: args });
					return stmt;
				},
				run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
				all: vi.fn().mockResolvedValue({ results: [] }),
			};
			return stmt;
		},
		batch: vi
			.fn()
			.mockImplementation((stmts: unknown[]) =>
				Promise.resolve(stmts.map(() => ({ meta: { changes: 1 } }))),
			),
		_preparedStmts: preparedStmts,
	};

	return db as unknown as D1Database & {
		_preparedStmts: typeof preparedStmts;
		batch: ReturnType<typeof vi.fn>;
	};
}

const CHANNEL: Channel = {
	id: "ch_test",
	slug: "test_rss",
	name: "Test Feed",
	channel_type: "rss",
	config: '{"feed_url":"https://example.com/feed.xml"}',
};

const SAMPLE_ARTICLES: ArticleWithContent[] = [
	{
		url: "https://example.com/post-1",
		title: "記事1",
		description: "説明1",
		content: "# 記事1の本文",
		publishedAt: "2026-03-13T00:00:00Z",
		metadata: { bookmark_count: 100 },
	},
	{
		url: "https://example.com/post-2",
		title: "記事2",
		description: "説明2",
		content: "# 記事2の本文",
		publishedAt: "2026-03-12T00:00:00Z",
		metadata: {},
	},
];

describe("collectFeedArticles", () => {
	it("記事をDBに保存し、収集結果を返す", async () => {
		const db = createMockDb();

		const result = await collectFeedArticles(db, CHANNEL, SAMPLE_ARTICLES);

		expect(result.articlesFound).toBe(2);
		expect(result.articlesNew).toBe(2);
		// batch が2回呼ばれる（記事INSERT + collection_items INSERT）
		expect(db.batch).toHaveBeenCalledTimes(2);
	});

	it("空の記事リストでは何も保存しない", async () => {
		const db = createMockDb();

		const result = await collectFeedArticles(db, CHANNEL, []);

		expect(result).toEqual({ articlesFound: 0, articlesNew: 0 });
		expect(db.batch).not.toHaveBeenCalled();
	});

	it("configのcontent_typeを使用する", async () => {
		const db = createMockDb();
		const channel: Channel = {
			...CHANNEL,
			config:
				'{"feed_url":"https://example.com/feed.xml","content_type":"news"}',
		};

		await collectFeedArticles(db, channel, SAMPLE_ARTICLES);

		// INSERT文のbindにcontent_typeが含まれていることを確認
		const articleInserts = db._preparedStmts.filter((s) =>
			s.sql.includes("INSERT OR IGNORE INTO articles"),
		);
		for (const stmt of articleInserts) {
			expect(stmt.binds).toContain("news");
		}
	});

	it("content_type未指定時はblogがデフォルト", async () => {
		const db = createMockDb();

		await collectFeedArticles(db, CHANNEL, SAMPLE_ARTICLES);

		const articleInserts = db._preparedStmts.filter((s) =>
			s.sql.includes("INSERT OR IGNORE INTO articles"),
		);
		for (const stmt of articleInserts) {
			expect(stmt.binds).toContain("blog");
		}
	});

	it("重複記事がある場合はnewCountが少なくなる", async () => {
		const db = createMockDb();
		// 1件目は既存（changes=0）、2件目は新規（changes=1）
		db.batch.mockResolvedValueOnce([
			{ meta: { changes: 0 } },
			{ meta: { changes: 1 } },
		]);

		const result = await collectFeedArticles(db, CHANNEL, SAMPLE_ARTICLES);

		expect(result.articlesFound).toBe(2);
		expect(result.articlesNew).toBe(1);
	});
});

describe("crawlChannel", () => {
	it("feed_urlがないチャネルはスキップする", async () => {
		const db = createMockDb();
		const channel: Channel = {
			...CHANNEL,
			config: "{}",
		};

		const result = await crawlChannel(db, channel);

		expect(result).toEqual({ articlesFound: 0, articlesNew: 0 });
	});
});

function createMockDbWithChannels(channels: Channel[]) {
	const preparedStmts: { sql: string; binds: unknown[] }[] = [];

	const db = {
		prepare: (sql: string) => {
			const stmt = {
				bind: (...args: unknown[]) => {
					preparedStmts.push({ sql, binds: args });
					return stmt;
				},
				run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
				all: sql.includes("SELECT id, slug")
					? vi.fn().mockResolvedValue({ results: channels })
					: vi.fn().mockResolvedValue({ results: [] }),
			};
			return stmt;
		},
		batch: vi
			.fn()
			.mockImplementation((stmts: unknown[]) =>
				Promise.resolve(stmts.map(() => ({ meta: { changes: 1 } }))),
			),
		_preparedStmts: preparedStmts,
	};

	return db as unknown as D1Database & {
		_preparedStmts: typeof preparedStmts;
		batch: ReturnType<typeof vi.fn>;
	};
}

vi.mock("../../agent/feed", () => ({
	fetchFeed: vi.fn().mockResolvedValue([]),
}));

describe("crawlAllChannels", () => {
	it("チャネルがない場合は空配列を返す", async () => {
		const db = createMockDbWithChannels([]);

		const results = await crawlAllChannels(db);

		expect(results).toEqual([]);
	});

	it("複数チャネルを並列にクロールし、結果を返す", async () => {
		const channels: Channel[] = [
			{
				id: "ch_1",
				slug: "feed_1",
				name: "Feed 1",
				channel_type: "rss",
				config: '{"feed_url":"https://example.com/feed1.xml"}',
			},
			{
				id: "ch_2",
				slug: "feed_2",
				name: "Feed 2",
				channel_type: "atom",
				config: '{"feed_url":"https://example.com/feed2.xml"}',
			},
		];

		const db = createMockDbWithChannels(channels);

		const results = await crawlAllChannels(db);

		expect(results).toHaveLength(2);
		expect(results[0].channel).toBe("feed_1");
		expect(results[1].channel).toBe("feed_2");
	});

	it("一部のチャネルが失敗しても他は成功する", async () => {
		const channels: Channel[] = [
			{
				id: "ch_ok",
				slug: "ok_feed",
				name: "OK Feed",
				channel_type: "rss",
				config: '{"feed_url":"https://example.com/ok.xml"}',
			},
			{
				id: "ch_fail",
				slug: "fail_feed",
				name: "Fail Feed",
				channel_type: "rss",
				config: '{"feed_url":"https://example.com/fail.xml"}',
			},
		];

		const db = createMockDbWithChannels(channels);

		const { fetchFeed } = await import("../../agent/feed");
		const mockFetchFeed = vi.mocked(fetchFeed);
		mockFetchFeed
			.mockResolvedValueOnce([])
			.mockRejectedValueOnce(new Error("network error"));

		const results = await crawlAllChannels(db);

		expect(results).toHaveLength(2);
		expect(results[0]).toEqual({
			channel: "ok_feed",
			articlesFound: 0,
			articlesNew: 0,
		});
		expect(results[1]).toEqual({
			channel: "fail_feed",
			articlesFound: 0,
			articlesNew: 0,
		});
	});
});
