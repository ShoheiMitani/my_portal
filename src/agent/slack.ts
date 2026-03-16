import { filterAndStoreArticles } from "./crawl";
import type { Channel, FeedArticle } from "./types";

const TIMESTAMP_MAX_AGE_SECONDS = 60 * 5;

/**
 * Slackリクエストの署名を検証する
 */
export async function verifySlackSignature(
	secret: string,
	timestamp: string,
	body: string,
	signature: string,
): Promise<boolean> {
	const now = Math.floor(Date.now() / 1000);
	if (Math.abs(now - Number(timestamp)) > TIMESTAMP_MAX_AGE_SECONDS) {
		return false;
	}

	const encoder = new TextEncoder();
	const key = await crypto.subtle.importKey(
		"raw",
		encoder.encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const sig = await crypto.subtle.sign(
		"HMAC",
		key,
		encoder.encode(`v0:${timestamp}:${body}`),
	);
	const hex = [...new Uint8Array(sig)]
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
	const expected = `v0=${hex}`;

	return expected === signature;
}

/**
 * SlackメッセージテキストからURLを抽出する
 * Slackは <https://example.com|label> 形式でURLを埋め込む
 */
export function extractUrls(text: string): string[] {
	const matches = text.matchAll(/<(https?:\/\/[^|>]+)[^>]*>/g);
	return [...matches].map((m) => m[1]);
}

/**
 * URLリストをSlackチャネル経由の記事としてDBに保存する
 */
export async function processSlackUrls(
	db: D1Database,
	urls: string[],
): Promise<{ articlesFound: number; articlesNew: number }> {
	if (urls.length === 0) return { articlesFound: 0, articlesNew: 0 };

	const { results: channels } = await db
		.prepare(
			"SELECT id, slug, name, channel_type, config FROM channels WHERE slug = 'slack_shared'",
		)
		.all<Channel>();

	if (channels.length === 0) {
		console.log("[slack] slack_shared channel not found");
		return { articlesFound: 0, articlesNew: 0 };
	}

	const channel = channels[0];
	const config = JSON.parse(channel.config) as { content_type?: string };

	const articles: FeedArticle[] = urls.map((url) => ({
		url,
		title: url,
		description: "",
		publishedAt: new Date().toISOString(),
		metadata: { source: "slack" },
	}));

	return filterAndStoreArticles(db, channel, articles, config);
}

/**
 * Slackスレッドに取り込み完了通知を送信する
 */
export async function notifySlackThread(
	token: string,
	channel: string,
	threadTs: string,
	result: { articlesFound: number; articlesNew: number },
): Promise<void> {
	const text =
		result.articlesNew > 0
			? `${result.articlesNew}件の記事を取り込みました`
			: "すべて取り込み済みの記事です";

	const res = await fetch("https://slack.com/api/chat.postMessage", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			channel,
			thread_ts: threadTs,
			text,
		}),
	});
	const data = (await res.json()) as { ok: boolean; error?: string };
	if (!data.ok) {
		console.error("[slack] chat.postMessage failed:", data.error);
	}
}
