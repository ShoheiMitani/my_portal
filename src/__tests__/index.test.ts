import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../index";
import {
	hatenaRssSingle,
	speakerdeckAtomSingle,
	stubFetchError,
	stubFetchForBlog,
	stubFetchForSlides,
} from "./fixtures/feeds";

vi.mock("../agent/crawl", () => ({
	crawlAllChannels: vi
		.fn()
		.mockResolvedValue([
			{ channel: "test_rss", articlesFound: 3, articlesNew: 1 },
		]),
	USER_AGENT: "TestBot/1.0",
	filterAndStoreArticles: vi.fn(),
}));

vi.mock("../agent/slack", () => ({
	verifySlackSignature: vi.fn().mockResolvedValue(true),
	extractUrls: vi.fn().mockReturnValue(["https://example.com/article"]),
	processSlackUrls: vi
		.fn()
		.mockResolvedValue({ articlesFound: 1, articlesNew: 1 }),
	notifySlackThread: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../agent/topics", () => ({
	parsePeriod: vi.fn((v: string) =>
		["daily", "weekly"].includes(v) ? v : null,
	),
}));

describe("GET /api/feeds/blog", () => {
	beforeEach(() => {
		stubFetchForBlog(hatenaRssSingle);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("returns 200 with JSON", async () => {
		const res = await app.request("/api/feeds/blog");
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toContain("application/json");
	});

	it("returns blog entries", async () => {
		const res = await app.request("/api/feeds/blog");
		const data = (await res.json()) as { title: string; source: string }[];
		expect(data).toHaveLength(1);
		expect(data[0].title).toBe("テスト記事1");
		expect(data[0].source).toBe("Blog");
	});
});

describe("GET /api/feeds/slides", () => {
	beforeEach(() => {
		stubFetchForSlides(speakerdeckAtomSingle);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("returns 200 with JSON", async () => {
		const res = await app.request("/api/feeds/slides");
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toContain("application/json");
	});

	it("returns slide entries", async () => {
		const res = await app.request("/api/feeds/slides");
		const data = (await res.json()) as { title: string; source: string }[];
		expect(data).toHaveLength(1);
		expect(data[0].title).toBe("テスト発表資料1");
		expect(data[0].source).toBe("Slide");
	});

	it("handles fetch errors gracefully", async () => {
		stubFetchError();
		const res = await app.request("/api/feeds/slides");
		expect(res.status).toBe(200);
		const data = (await res.json()) as { title: string; source: string }[];
		expect(data).toEqual([]);
	});
});

const mockStub = {
	fetch: vi.fn().mockResolvedValue(Response.json({ status: "started" })),
};
const mockExecutionCtx = {
	waitUntil: vi.fn(),
	passThroughOnException: vi.fn(),
} as unknown as ExecutionContext;
const mockEnv = {
	DB: {} as D1Database,
	AI: {} as Ai,
	TrendCollector: {
		idFromName: () => "test-id",
		get: () => mockStub,
	} as unknown as DurableObjectNamespace,
	SLACK_SIGNING_SECRET: "test_secret",
	SLACK_BOT_TOKEN: "xoxb-test-token",
	X_CLIENT_ID: "test-x-client-id",
	X_CLIENT_SECRET: "test-x-client-secret",
	X_USER_ID: "test-x-user-id",
};

describe("POST /api/crawl", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("returns 200 with crawl results", async () => {
		const res = await app.request("/api/crawl", { method: "POST" }, mockEnv);
		expect(res.status).toBe(200);
		const data = (await res.json()) as {
			channel: string;
			articlesFound: number;
			articlesNew: number;
		}[];
		expect(data).toHaveLength(1);
		expect(data[0].channel).toBe("test_rss");
		expect(data[0].articlesFound).toBe(3);
		expect(data[0].articlesNew).toBe(1);
	});

	it("returns JSON content type", async () => {
		const res = await app.request("/api/crawl", { method: "POST" }, mockEnv);
		expect(res.headers.get("content-type")).toContain("application/json");
	});
});

describe("POST /api/slack/events", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("url_verificationにchallengeを返す", async () => {
		const body = JSON.stringify({
			type: "url_verification",
			challenge: "test_challenge_value",
		});
		const res = await app.request(
			"/api/slack/events",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"X-Slack-Signature": "v0=dummy",
					"X-Slack-Request-Timestamp": String(Math.floor(Date.now() / 1000)),
				},
				body,
			},
			mockEnv,
		);
		expect(res.status).toBe(200);
		const data = (await res.json()) as { challenge: string };
		expect(data.challenge).toBe("test_challenge_value");
	});

	it("署名検証失敗で401を返す", async () => {
		const { verifySlackSignature } = await import("../agent/slack");
		vi.mocked(verifySlackSignature).mockResolvedValueOnce(false);

		const body = JSON.stringify({
			type: "event_callback",
			event: { type: "message", text: "hello" },
		});
		const res = await app.request(
			"/api/slack/events",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"X-Slack-Signature": "v0=invalid",
					"X-Slack-Request-Timestamp": String(Math.floor(Date.now() / 1000)),
				},
				body,
			},
			mockEnv,
		);
		expect(res.status).toBe(401);
	});

	it("メッセージイベントで200を返す", async () => {
		const body = JSON.stringify({
			type: "event_callback",
			event: {
				type: "message",
				text: "<https://example.com/article|example>",
			},
		});
		const res = await app.request(
			"/api/slack/events",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"X-Slack-Signature": "v0=dummy",
					"X-Slack-Request-Timestamp": String(Math.floor(Date.now() / 1000)),
				},
				body,
			},
			mockEnv,
			mockExecutionCtx,
		);
		expect(res.status).toBe(200);
	});

	it("botメッセージはスキップする", async () => {
		const { processSlackUrls } = await import("../agent/slack");
		vi.mocked(processSlackUrls).mockClear();

		const body = JSON.stringify({
			type: "event_callback",
			event: {
				type: "message",
				text: "<https://example.com/article>",
				bot_id: "B12345",
			},
		});
		const res = await app.request(
			"/api/slack/events",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"X-Slack-Signature": "v0=dummy",
					"X-Slack-Request-Timestamp": String(Math.floor(Date.now() / 1000)),
				},
				body,
			},
			mockEnv,
		);
		expect(res.status).toBe(200);
		expect(processSlackUrls).not.toHaveBeenCalled();
	});
});

describe("topic preference API", () => {
	const makeDbMock = (topicRow: unknown) => {
		const first = vi.fn().mockResolvedValue(topicRow);
		const run = vi.fn().mockResolvedValue({ success: true });
		const batch = vi.fn().mockResolvedValue([]);
		const prepare = vi.fn((_sql: string) => ({
			bind: vi.fn(() => ({ first, run })),
		}));
		return {
			db: { prepare, batch } as unknown as D1Database,
			prepare,
			first,
			run,
			batch,
		};
	};

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("POST /api/topics/:id/preference", () => {
		it("好みを登録して200を返す", async () => {
			const { db, prepare, run } = makeDbMock({
				title: "GPT-5.4 Omni発表",
				summary: "OpenAIが新モデルを発表",
				category: "AI",
			});
			const res = await app.request(
				"/api/topics/topic-1/preference",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ preference: "dislike" }),
				},
				{ ...mockEnv, DB: db },
			);
			expect(res.status).toBe(200);
			const data = (await res.json()) as { ok: boolean; preference: string };
			expect(data.ok).toBe(true);
			expect(data.preference).toBe("dislike");
			expect(run).toHaveBeenCalled();
			const insertSql = prepare.mock.calls
				.map((c) => c[0])
				.find((sql) => sql.includes("INSERT INTO topic_preferences"));
			expect(insertSql).toContain("ON CONFLICT(topic_title)");
		});

		it("preferenceが不正なら400を返す", async () => {
			const { db } = makeDbMock(null);
			const res = await app.request(
				"/api/topics/topic-1/preference",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ preference: "invalid" }),
				},
				{ ...mockEnv, DB: db },
			);
			expect(res.status).toBe(400);
		});

		it("トピックが存在しなければ404を返す", async () => {
			const { db } = makeDbMock(null);
			const res = await app.request(
				"/api/topics/nonexistent/preference",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ preference: "like" }),
				},
				{ ...mockEnv, DB: db },
			);
			expect(res.status).toBe(404);
		});
	});

	describe("DELETE /api/topics/:id/preference", () => {
		it("好みを削除し、降格フラグも解除して200を返す", async () => {
			const { db, prepare, batch } = makeDbMock({ title: "GPT-5.4 Omni発表" });
			const res = await app.request(
				"/api/topics/topic-1/preference",
				{ method: "DELETE" },
				{ ...mockEnv, DB: db },
			);
			expect(res.status).toBe(200);
			expect(batch).toHaveBeenCalled();
			const sqls = prepare.mock.calls.map((c) => c[0]);
			expect(
				sqls.some((sql) => sql.includes("DELETE FROM topic_preferences")),
			).toBe(true);
			expect(
				sqls.some((sql) => sql.includes("UPDATE topics SET demoted = 0")),
			).toBe(true);
		});

		it("トピックが存在しなければ404を返す", async () => {
			const { db } = makeDbMock(null);
			const res = await app.request(
				"/api/topics/nonexistent/preference",
				{ method: "DELETE" },
				{ ...mockEnv, DB: db },
			);
			expect(res.status).toBe(404);
		});
	});
});

describe("GET /api/topics", () => {
	it("トピック一覧にpreferenceを含めて返す", async () => {
		const all = vi.fn().mockResolvedValue({
			results: [
				{
					id: "t1",
					title: "GPT-5.4 Omni発表",
					summary: "概要",
					source_count: 3,
					period_type: "daily",
					generated_at: "2026-07-17",
					preference: "dislike",
				},
			],
		});
		const prepare = vi.fn((_sql: string) => ({ bind: vi.fn(() => ({ all })) }));
		const db = { prepare } as unknown as D1Database;

		const res = await app.request(
			"/api/topics?period=daily",
			{},
			{
				...mockEnv,
				DB: db,
			},
		);
		expect(res.status).toBe(200);
		const data = (await res.json()) as { preference: string | null }[];
		expect(data[0].preference).toBe("dislike");
		// 好みテーブルと結合し、降格トピックを末尾に回すクエリになっている
		const sql = prepare.mock.calls[0][0];
		expect(sql).toContain("topic_preferences");
		expect(sql).toContain("demoted");
	});
});

describe("GET /api/topics/:id", () => {
	it("トピック詳細にpreferenceを含めて返す", async () => {
		const first = vi.fn().mockResolvedValue({
			id: "t1",
			title: "GPT-5.4の躍進とAIの進化",
			summary: "概要",
			source_count: 4,
			period_type: "daily",
			generated_at: "2026-07-17",
			preference: "like",
		});
		const all = vi.fn().mockResolvedValue({ results: [] });
		const prepare = vi.fn((_sql: string) => ({
			bind: vi.fn(() => ({ first, all })),
		}));
		const db = { prepare } as unknown as D1Database;

		const res = await app.request("/api/topics/t1", {}, { ...mockEnv, DB: db });
		expect(res.status).toBe(200);
		const data = (await res.json()) as {
			preference: string | null;
			articles: unknown[];
		};
		expect(data.preference).toBe("like");
		expect(data.articles).toEqual([]);
		// 好みテーブルと結合してpreferenceを取得している
		const topicSql = prepare.mock.calls[0][0];
		expect(topicSql).toContain("topic_preferences");
	});

	it("トピックが存在しなければ404を返す", async () => {
		const first = vi.fn().mockResolvedValue(null);
		const prepare = vi.fn((_sql: string) => ({
			bind: vi.fn(() => ({ first })),
		}));
		const db = { prepare } as unknown as D1Database;

		const res = await app.request(
			"/api/topics/nonexistent",
			{},
			{ ...mockEnv, DB: db },
		);
		expect(res.status).toBe(404);
	});
});

describe("GET /api/articles", () => {
	it("returns 200 with JSON", async () => {
		const mockDb = {
			prepare: () => ({
				bind: () => ({
					all: vi.fn().mockResolvedValue({ results: [] }),
				}),
			}),
		} as unknown as D1Database;
		const env = { ...mockEnv, DB: mockDb };

		const res = await app.request("/api/articles", {}, env);
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toContain("application/json");
	});
});

describe("scheduled handler", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it("calls crawlAllChannels and generates daily topics on non-Monday", async () => {
		const { crawlAllChannels } = await import("../agent/crawl");
		const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
		const mockWaitUntil = vi.fn((p: Promise<unknown>) => p);
		mockStub.fetch.mockClear();
		vi.setSystemTime(new Date("2026-04-28T12:00:00.000Z")); // Tuesday

		const handler = (await import("../index")).default;
		await handler.scheduled({} as ScheduledEvent, mockEnv, {
			waitUntil: mockWaitUntil,
		} as unknown as ExecutionContext);

		expect(crawlAllChannels).toHaveBeenCalled();
		expect(mockWaitUntil).toHaveBeenCalled();
		expect(mockStub.fetch).toHaveBeenCalledTimes(1);
		const req = vi.mocked(mockStub.fetch).mock.calls[0][0] as Request;
		expect(await req.json()).toEqual({ periods: ["daily"] });
		consoleSpy.mockRestore();
	});

	it("includes weekly topics on Monday", async () => {
		const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
		const mockWaitUntil = vi.fn((p: Promise<unknown>) => p);
		mockStub.fetch.mockClear();
		vi.setSystemTime(new Date("2026-04-27T12:00:00.000Z")); // Monday

		const handler = (await import("../index")).default;
		await handler.scheduled({} as ScheduledEvent, mockEnv, {
			waitUntil: mockWaitUntil,
		} as unknown as ExecutionContext);

		expect(mockStub.fetch).toHaveBeenCalledTimes(1);
		const req = vi.mocked(mockStub.fetch).mock.calls[0][0] as Request;
		expect(await req.json()).toEqual({ periods: ["daily", "weekly"] });
		consoleSpy.mockRestore();
	});
});
