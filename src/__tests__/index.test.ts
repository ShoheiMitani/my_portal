import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import app from "../index";
import {
	hatenaRssSingle,
	speakerdeckAtomSingle,
	stubFetchError,
	stubFetchForBlog,
	stubFetchForSlides,
} from "./fixtures/feeds";

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
