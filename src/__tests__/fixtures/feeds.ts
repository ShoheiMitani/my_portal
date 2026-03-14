import { type Mock, vi } from "vitest";

export const hatenaRssSingle = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
<item>
	<title>テスト記事1</title>
	<link>https://shohei1913.hatenablog.com/entry/2026/03/01/test1</link>
	<pubDate>Sun, 01 Mar 2026 00:00:00 +0900</pubDate>
	<enclosure url="https://example.com/blog-thumb1.png" type="image/png" length="0" />
</item>
</channel>
</rss>`;

export const hatenaRssMultiple = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
<item>
	<title>テスト記事1</title>
	<link>https://shohei1913.hatenablog.com/entry/2026/03/01/test1</link>
	<pubDate>Sun, 01 Mar 2026 00:00:00 +0900</pubDate>
	<enclosure url="https://example.com/blog-thumb1.png" type="image/png" length="0" />
</item>
<item>
	<title>テスト記事2</title>
	<link>https://shohei1913.hatenablog.com/entry/2026/02/15/test2</link>
	<pubDate>Sun, 15 Feb 2026 00:00:00 +0900</pubDate>
	<enclosure url="https://example.com/blog-thumb2.png" type="image/png" length="0" />
</item>
</channel>
</rss>`;

export const speakerdeckAtomSingle = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
<entry>
	<published>2026-02-20T00:00:00Z</published>
	<link rel="alternate" type="text/html" href="https://speakerdeck.com/shoheimitani/test-slide1"/>
	<title>テスト発表資料1</title>
	<media:thumbnail url="https://example.com/slide-thumb1.jpg" xmlns:media='http://search.yahoo.com/mrss/'/>
</entry>
</feed>`;

export const speakerdeckAtomMultiple = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
<entry>
	<published>2026-02-20T00:00:00Z</published>
	<link rel="alternate" type="text/html" href="https://speakerdeck.com/shoheimitani/test-slide1"/>
	<title>テスト発表資料1</title>
	<media:thumbnail url="https://example.com/slide-thumb1.jpg" xmlns:media='http://search.yahoo.com/mrss/'/>
</entry>
<entry>
	<published>2026-01-10T00:00:00Z</published>
	<link rel="alternate" type="text/html" href="https://speakerdeck.com/shoheimitani/test-slide2"/>
	<title>テスト発表資料2</title>
	<media:thumbnail url="https://example.com/slide-thumb2.jpg" xmlns:media='http://search.yahoo.com/mrss/'/>
</entry>
</feed>`;

export function stubFetchForBlog(hatenaRss: string): Mock {
	const mock = vi.fn((url: string) => {
		if (url.includes("hatenablog.com/rss")) {
			return Promise.resolve(new Response(hatenaRss));
		}
		return Promise.resolve(new Response("", { status: 404 }));
	});
	vi.stubGlobal("fetch", mock);
	return mock;
}

export function stubFetchForSlides(speakerdeckAtom: string): Mock {
	const mock = vi.fn((url: string) => {
		if (url.includes("speakerdeck.com") && url.includes(".atom")) {
			return Promise.resolve(new Response(speakerdeckAtom));
		}
		return Promise.resolve(new Response("", { status: 404 }));
	});
	vi.stubGlobal("fetch", mock);
	return mock;
}

export function stubFetchError(): Mock {
	const mock = vi.fn(() => Promise.reject(new Error("Network error")));
	vi.stubGlobal("fetch", mock);
	return mock;
}
