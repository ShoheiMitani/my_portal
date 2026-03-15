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
const mockEnv = {
	DB: {} as D1Database,
	AI: {} as Ai,
	TrendCollector: {
		idFromName: () => "test-id",
		get: () => mockStub,
	} as unknown as DurableObjectNamespace,
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
