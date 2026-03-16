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
	it("calls crawlAllChannels and logs results", async () => {
		const { crawlAllChannels } = await import("../agent/crawl");
		const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
		const mockWaitUntil = vi.fn((p: Promise<unknown>) => p);

		const handler = (await import("../index")).default;
		await handler.scheduled({} as ScheduledEvent, mockEnv, {
			waitUntil: mockWaitUntil,
		} as unknown as ExecutionContext);

		expect(crawlAllChannels).toHaveBeenCalled();
		expect(mockWaitUntil).toHaveBeenCalled();
		consoleSpy.mockRestore();
	});
});
