import { decodeHtmlEntities, extractAttr, extractTag } from "../lib/xml";
import { USER_AGENT } from "./crawl";
import type { FeedArticle } from "./types";

/**
 * RSS 2.0 / RDF (はてな等) / Atom を自動判定してパースする汎用フィードパーサー
 */
export function parseFeed(xml: string): FeedArticle[] {
	if (xml.includes("<feed")) {
		return parseAtom(xml);
	}
	if (xml.includes("<item")) {
		return parseRss(xml);
	}
	return [];
}

function parseRss(xml: string): FeedArticle[] {
	const items = xml.match(/<item[\s\S]*?<\/item>/g) || [];
	return items.flatMap((item) => {
		const url =
			extractTag(item, "link") || extractAttr(item, "item", "rdf:about");
		if (!url) return [];

		const metadata: Record<string, unknown> = {};
		const bookmarkCount = extractTag(item, "hatena:bookmarkcount");
		if (bookmarkCount) {
			metadata.bookmark_count = Number(bookmarkCount) || 0;
		}

		return [
			{
				url,
				title: decodeHtmlEntities(extractTag(item, "title")),
				description: decodeHtmlEntities(extractTag(item, "description")),
				publishedAt:
					extractTag(item, "dc:date") || extractTag(item, "pubDate") || "",
				metadata,
			},
		];
	});
}

function parseAtom(xml: string): FeedArticle[] {
	const entries = xml.match(/<entry[\s\S]*?<\/entry>/g) || [];
	return entries.flatMap((entry) => {
		const url = extractAttr(entry, "link", "href") || extractTag(entry, "link");
		if (!url) return [];

		const description =
			extractTag(entry, "summary") || extractTag(entry, "content");

		return [
			{
				url,
				title: decodeHtmlEntities(extractTag(entry, "title")),
				description: decodeHtmlEntities(description),
				publishedAt:
					extractTag(entry, "published") || extractTag(entry, "updated") || "",
				metadata: {},
			},
		];
	});
}

export async function fetchFeed(feedUrl: string): Promise<FeedArticle[]> {
	const res = await fetch(feedUrl, {
		headers: { "User-Agent": USER_AGENT },
	});
	if (!res.ok) return [];
	const xml = await res.text();
	return parseFeed(xml);
}
