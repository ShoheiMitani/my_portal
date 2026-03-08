import type { FeedEntry } from "../types";
import { extractAttr, extractTag } from "./xml";

export async function fetchHatenaBlog(): Promise<FeedEntry[]> {
	const res = await fetch("https://shohei1913.hatenablog.com/rss");
	if (!res.ok) return [];
	const xml = await res.text();
	const items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
	return items.map((item) => ({
		title: extractTag(item, "title"),
		link: extractTag(item, "link"),
		date: new Date(extractTag(item, "pubDate")),
		source: "Blog" as const,
		thumbnail: extractAttr(item, "enclosure", "url"),
	}));
}

export async function fetchSpeakerDeck(): Promise<FeedEntry[]> {
	const res = await fetch("https://speakerdeck.com/shoheimitani.atom");
	if (!res.ok) return [];
	const xml = await res.text();
	const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) || [];
	return entries.map((entry) => ({
		title: extractTag(entry, "title"),
		link: extractAttr(entry, "link", "href"),
		date: new Date(extractTag(entry, "published")),
		source: "Slide" as const,
		thumbnail: extractAttr(entry, "media:thumbnail", "url"),
	}));
}

export function formatDate(d: Date): string {
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
