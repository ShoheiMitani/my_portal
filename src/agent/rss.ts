import { extractTag } from "../lib/xml";
import type { RssArticle } from "./types";

const HATENA_HOTENTRY_IT_RSS = "https://b.hatena.ne.jp/hotentry/it.rss";

export function parseHatenaRss(xml: string): RssArticle[] {
	const items = xml.match(/<item[\s\S]*?<\/item>/g) || [];
	return items.map((item) => ({
		url: extractTag(item, "link"),
		title: extractTag(item, "title"),
		description: extractTag(item, "description"),
		publishedAt: extractTag(item, "dc:date"),
		bookmarkCount: Number(extractTag(item, "hatena:bookmarkcount")) || 0,
	}));
}

export async function fetchHatenaHotentries(): Promise<RssArticle[]> {
	const res = await fetch(HATENA_HOTENTRY_IT_RSS);
	if (!res.ok) return [];
	const xml = await res.text();
	return parseHatenaRss(xml);
}
