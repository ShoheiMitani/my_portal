import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../index";
import {
	hatenaRssMultiple,
	speakerdeckAtomMultiple,
	stubFetchError,
	stubFetchForBlog,
	stubFetchForSlides,
} from "./fixtures/feeds";

describe("GET /api/feeds/blog", () => {
	beforeEach(() => {
		stubFetchForBlog(hatenaRssMultiple);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("returns blog entries with correct fields", async () => {
		const res = await app.request("/api/feeds/blog");
		const data = (await res.json()) as {
			title: string;
			link: string;
			source: string;
			thumbnail: string;
		}[];
		expect(data).toHaveLength(2);
		expect(data[0].title).toBe("テスト記事1");
		expect(data[0].link).toBe(
			"https://shohei1913.hatenablog.com/entry/2026/03/01/test1",
		);
		expect(data[0].source).toBe("Blog");
		expect(data[0].thumbnail).toBe("https://example.com/blog-thumb1.png");
	});

	it("handles fetch errors gracefully", async () => {
		stubFetchError();
		const res = await app.request("/api/feeds/blog");
		expect(res.status).toBe(200);
		const data = (await res.json()) as unknown[];
		expect(data).toEqual([]);
	});
});

describe("GET /api/feeds/slides", () => {
	beforeEach(() => {
		stubFetchForSlides(speakerdeckAtomMultiple);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("returns slide entries with correct fields", async () => {
		const res = await app.request("/api/feeds/slides");
		const data = (await res.json()) as {
			title: string;
			link: string;
			source: string;
			thumbnail: string;
		}[];
		expect(data).toHaveLength(2);
		expect(data[0].title).toBe("テスト発表資料1");
		expect(data[0].link).toBe(
			"https://speakerdeck.com/shoheimitani/test-slide1",
		);
		expect(data[0].source).toBe("Slide");
		expect(data[0].thumbnail).toBe("https://example.com/slide-thumb1.jpg");
	});
});
