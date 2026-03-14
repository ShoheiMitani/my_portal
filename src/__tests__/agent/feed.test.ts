import { describe, expect, it } from "vitest";
import { parseFeed } from "../../agent/feed";

const RSS_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test Blog</title>
    <item>
      <title>RSS記事タイトル</title>
      <link>https://example.com/rss-article</link>
      <description>RSS記事の説明文</description>
      <pubDate>Mon, 10 Mar 2026 10:00:00 GMT</pubDate>
    </item>
    <item>
      <title>2番目の記事</title>
      <link>https://example.com/rss-article-2</link>
      <description>2番目の説明</description>
      <pubDate>Tue, 11 Mar 2026 12:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

const ATOM_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Test Atom Feed</title>
  <entry>
    <title>Atom記事タイトル</title>
    <link href="https://example.com/atom-article" />
    <summary>Atom記事の説明文</summary>
    <published>2026-03-10T10:00:00Z</published>
  </entry>
  <entry>
    <title>Atom 2番目</title>
    <link href="https://example.com/atom-article-2" />
    <summary>2番目の説明</summary>
    <updated>2026-03-11T12:00:00Z</updated>
  </entry>
</feed>`;

const RDF_HATENA_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
         xmlns:dc="http://purl.org/dc/elements/1.1/"
         xmlns:hatena="http://www.hatena.ne.jp/info/xmlns#">
  <item rdf:about="https://example.com/hatena-article">
    <title>はてな記事</title>
    <link>https://example.com/hatena-article</link>
    <description>はてな記事の説明</description>
    <dc:date>2026-03-10T10:00:00Z</dc:date>
    <hatena:bookmarkcount>200</hatena:bookmarkcount>
  </item>
</rdf:RDF>`;

describe("parseFeed", () => {
	it("RSS 2.0をパースできる", () => {
		const articles = parseFeed(RSS_SAMPLE);

		expect(articles).toHaveLength(2);
		expect(articles[0]).toEqual({
			url: "https://example.com/rss-article",
			title: "RSS記事タイトル",
			description: "RSS記事の説明文",
			publishedAt: "Mon, 10 Mar 2026 10:00:00 GMT",
			metadata: {},
		});
	});

	it("Atomをパースできる", () => {
		const articles = parseFeed(ATOM_SAMPLE);

		expect(articles).toHaveLength(2);
		expect(articles[0]).toEqual({
			url: "https://example.com/atom-article",
			title: "Atom記事タイトル",
			description: "Atom記事の説明文",
			publishedAt: "2026-03-10T10:00:00Z",
			metadata: {},
		});
	});

	it("publishedがなくupdatedがある場合はupdatedを使う", () => {
		const articles = parseFeed(ATOM_SAMPLE);
		expect(articles[1].publishedAt).toBe("2026-03-11T12:00:00Z");
	});

	it("はてなRDF形式をパースし、bookmark_countをmetadataに含める", () => {
		const articles = parseFeed(RDF_HATENA_SAMPLE);

		expect(articles).toHaveLength(1);
		expect(articles[0].url).toBe("https://example.com/hatena-article");
		expect(articles[0].metadata).toEqual({ bookmark_count: 200 });
	});

	it("CDATAで囲まれたタイトル・説明をパースできる", () => {
		const cdata_rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <item>
      <title><![CDATA[CDATA記事タイトル]]></title>
      <link>https://example.com/cdata-article</link>
      <description><![CDATA[CDATA説明文]]></description>
      <pubDate>Fri, 14 Mar 2026 10:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;
		const articles = parseFeed(cdata_rss);

		expect(articles).toHaveLength(1);
		expect(articles[0].title).toBe("CDATA記事タイトル");
		expect(articles[0].description).toBe("CDATA説明文");
	});

	it("空のフィードは空配列を返す", () => {
		expect(parseFeed("<rss><channel></channel></rss>")).toEqual([]);
		expect(parseFeed("<feed></feed>")).toEqual([]);
		expect(parseFeed("")).toEqual([]);
	});
});
