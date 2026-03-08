import { describe, expect, it } from "vitest";
import { parseHatenaRss } from "../../agent/rss";

const SAMPLE_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
         xmlns:dc="http://purl.org/dc/elements/1.1/"
         xmlns:hatena="http://www.hatena.ne.jp/info/xmlns#">
  <item rdf:about="https://example.com/article-1">
    <title>AIコードレビューの是非</title>
    <link>https://example.com/article-1</link>
    <description>AIが生成したコードをレビューすべきかどうか。</description>
    <dc:date>2026-03-08T01:48:55Z</dc:date>
    <hatena:bookmarkcount>201</hatena:bookmarkcount>
  </item>
  <item rdf:about="https://example.com/article-2">
    <title>Rustで作るWebAssembly入門</title>
    <link>https://example.com/article-2</link>
    <description>RustとWasmの組み合わせを解説。</description>
    <dc:date>2026-03-07T15:00:00Z</dc:date>
    <hatena:bookmarkcount>85</hatena:bookmarkcount>
  </item>
</rdf:RDF>`;

describe("parseHatenaRss", () => {
	it("RSSのXMLから記事リストをパースできる", () => {
		const articles = parseHatenaRss(SAMPLE_RSS);

		expect(articles).toHaveLength(2);
		expect(articles[0]).toEqual({
			url: "https://example.com/article-1",
			title: "AIコードレビューの是非",
			description: "AIが生成したコードをレビューすべきかどうか。",
			publishedAt: "2026-03-08T01:48:55Z",
			bookmarkCount: 201,
		});
		expect(articles[1]).toEqual({
			url: "https://example.com/article-2",
			title: "Rustで作るWebAssembly入門",
			description: "RustとWasmの組み合わせを解説。",
			publishedAt: "2026-03-07T15:00:00Z",
			bookmarkCount: 85,
		});
	});

	it("空のRSSの場合は空配列を返す", () => {
		const articles = parseHatenaRss("<rdf:RDF></rdf:RDF>");
		expect(articles).toEqual([]);
	});

	it("bookmarkcountが無い場合は0になる", () => {
		const xml = `<rdf:RDF>
      <item rdf:about="https://example.com/no-count">
        <title>テスト記事</title>
        <link>https://example.com/no-count</link>
        <description>説明文</description>
        <dc:date>2026-03-08T00:00:00Z</dc:date>
      </item>
    </rdf:RDF>`;
		const articles = parseHatenaRss(xml);
		expect(articles[0].bookmarkCount).toBe(0);
	});
});
