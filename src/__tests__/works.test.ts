import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import app from "../index";

const hatenaRss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
<item>
	<title>テスト記事1</title>
	<link>https://shohei1913.hatenablog.com/entry/2026/03/01/test1</link>
	<description>記事1の説明</description>
	<pubDate>Sun, 01 Mar 2026 00:00:00 +0900</pubDate>
	<guid isPermaLink="false">hatenablog://entry/1</guid>
	<enclosure url="https://example.com/blog-thumb1.png" type="image/png" length="0" />
</item>
<item>
	<title>テスト記事2</title>
	<link>https://shohei1913.hatenablog.com/entry/2026/02/15/test2</link>
	<description>記事2の説明</description>
	<pubDate>Sun, 15 Feb 2026 00:00:00 +0900</pubDate>
	<guid isPermaLink="false">hatenablog://entry/2</guid>
	<enclosure url="https://example.com/blog-thumb2.png" type="image/png" length="0" />
</item>
</channel>
</rss>`;

const speakerdeckAtom = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
<entry>
	<id>tag:speakerdeck.com,2005:Talk/1</id>
	<published>2026-02-20T00:00:00Z</published>
	<updated>2026-02-20T00:00:00Z</updated>
	<link rel="alternate" type="text/html" href="https://speakerdeck.com/shoheimitani/test-slide1"/>
	<title>テスト発表資料1</title>
	<media:thumbnail url="https://example.com/slide-thumb1.jpg" xmlns:media='http://search.yahoo.com/mrss/'/>
</entry>
<entry>
	<id>tag:speakerdeck.com,2005:Talk/2</id>
	<published>2026-01-10T00:00:00Z</published>
	<updated>2026-01-10T00:00:00Z</updated>
	<link rel="alternate" type="text/html" href="https://speakerdeck.com/shoheimitani/test-slide2"/>
	<title>テスト発表資料2</title>
	<media:thumbnail url="https://example.com/slide-thumb2.jpg" xmlns:media='http://search.yahoo.com/mrss/'/>
</entry>
</feed>`;

describe("GET /works", () => {
	beforeEach(() => {
		vi.stubGlobal(
			"fetch",
			vi.fn((url: string) => {
				if (url.includes("hatenablog.com/rss")) {
					return Promise.resolve(new Response(hatenaRss));
				}
				if (url.includes("speakerdeck.com") && url.includes(".atom")) {
					return Promise.resolve(new Response(speakerdeckAtom));
				}
				return Promise.resolve(new Response("", { status: 404 }));
			}),
		);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("returns 200", async () => {
		const res = await app.request("/works");
		expect(res.status).toBe(200);
	});

	it("returns HTML content type", async () => {
		const res = await app.request("/works");
		expect(res.headers.get("content-type")).toContain("text/html");
	});

	it("contains page title", async () => {
		const res = await app.request("/works");
		const body = await res.text();
		expect(body).toContain("Works");
	});

	it("contains blog entries", async () => {
		const res = await app.request("/works");
		const body = await res.text();
		expect(body).toContain("テスト記事1");
		expect(body).toContain("テスト記事2");
		expect(body).toContain(
			"https://shohei1913.hatenablog.com/entry/2026/03/01/test1",
		);
	});

	it("contains speakerdeck entries", async () => {
		const res = await app.request("/works");
		const body = await res.text();
		expect(body).toContain("テスト発表資料1");
		expect(body).toContain("テスト発表資料2");
		expect(body).toContain("https://speakerdeck.com/shoheimitani/test-slide1");
	});

	it("displays entries sorted by date (newest first)", async () => {
		const res = await app.request("/works");
		const body = await res.text();
		const pos1 = body.indexOf("テスト記事1"); // 2026-03-01
		const pos2 = body.indexOf("テスト発表資料1"); // 2026-02-20
		const pos3 = body.indexOf("テスト記事2"); // 2026-02-15
		const pos4 = body.indexOf("テスト発表資料2"); // 2026-01-10
		expect(pos1).toBeLessThan(pos2);
		expect(pos2).toBeLessThan(pos3);
		expect(pos3).toBeLessThan(pos4);
	});

	it("shows source labels (Blog / Slide)", async () => {
		const res = await app.request("/works");
		const body = await res.text();
		expect(body).toContain("Blog");
		expect(body).toContain("Slide");
	});

	it("contains link back to top page", async () => {
		const res = await app.request("/works");
		const body = await res.text();
		expect(body).toContain('href="/"');
	});

	it("displays thumbnails for entries", async () => {
		const res = await app.request("/works");
		const body = await res.text();
		expect(body).toContain("https://example.com/blog-thumb1.png");
		expect(body).toContain("https://example.com/slide-thumb1.jpg");
		expect(body).toContain("entry-thumbnail");
	});

	it("displays year separator for 2026", async () => {
		const res = await app.request("/works");
		const body = await res.text();
		expect(body).toContain("year-separator");
		expect(body).toContain(">2026<");
	});

	it("displays year separator before entries of that year", async () => {
		const res = await app.request("/works");
		const body = await res.text();
		const yearPos = body.indexOf(">2026<");
		const firstEntry = body.indexOf("テスト記事1");
		expect(yearPos).toBeLessThan(firstEntry);
	});

	it("handles fetch errors gracefully", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(() => Promise.reject(new Error("Network error"))),
		);
		const res = await app.request("/works");
		expect(res.status).toBe(200);
	});
});
