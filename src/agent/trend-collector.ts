import { AIChatAgent } from "@cloudflare/ai-chat";
import type { OnChatMessageOptions } from "@cloudflare/ai-chat";
import { callable } from "agents";
import { convertToModelMessages, stepCountIs, streamText, tool } from "ai";
import { createWorkersAI } from "workers-ai-provider";
import { z } from "zod/v4";
import { fetchHatenaHotentries } from "./rss";
import type { Interest, StoredArticle } from "./types";

interface Env {
	AI: Ai;
	DB: D1Database;
}

export class TrendCollectorAgent extends AIChatAgent<Env> {
	async onStart() {
		await this.scheduleEvery(1800, "crawl");
	}

	async crawl() {
		const db = this.env.DB;
		const articles = await fetchHatenaHotentries();

		const insertStmts = articles.map((article) =>
			db
				.prepare(
					"INSERT OR IGNORE INTO articles (id, url, title, description, published_at, bookmark_count, source) VALUES (?, ?, ?, ?, ?, ?, 'hatena')",
				)
				.bind(
					crypto.randomUUID(),
					article.url,
					article.title,
					article.description,
					article.publishedAt,
					article.bookmarkCount,
				),
		);

		const results = await db.batch(insertStmts);
		const newCount = results.reduce((sum, r) => sum + (r.meta.changes ?? 0), 0);

		await db
			.prepare(
				"INSERT INTO crawl_log (source, articles_found, articles_new) VALUES ('hatena', ?, ?)",
			)
			.bind(articles.length, newCount)
			.run();
	}

	async onChatMessage(
		_onFinish: Parameters<AIChatAgent["onChatMessage"]>[0],
		options?: OnChatMessageOptions,
	) {
		const db = this.env.DB;
		const workersai = createWorkersAI({ binding: this.env.AI });

		const { results: interests } = await db
			.prepare("SELECT keyword, description FROM interests")
			.all<Interest>();
		const interestText =
			interests.length > 0
				? interests
						.map(
							(i) =>
								`- ${i.keyword}${i.description ? `: ${i.description}` : ""}`,
						)
						.join("\n")
				: "（未登録）";

		const result = streamText({
			model: workersai("@cf/meta/llama-4-scout-17b-16e-instruct"),
			system: `あなたはテックトレンド分析アシスタントです。
ユーザーの興味分野に基づいて、蓄積された記事を横断的に分析し、世の中のトレンドや議論の流れを解説します。

## ユーザーの興味分野
${interestText}

## あなたの役割
- 個別の記事を紹介するのではなく、複数の記事から読み取れるトレンドや議論の方向性をまとめる
- 「世の中で何が話題になっているか」「どんな議論が起きているか」を俯瞰的に伝える
- ユーザーの興味分野に関連する動きがあれば優先的に取り上げる
- 具体的な記事URLは参考として示すが、あくまでトレンドの説明を主軸にする

ツールを使って蓄積された記事データを取得し、分析に活用してください。`,
			messages: await convertToModelMessages(this.messages),
			tools: {
				getRecentArticles: tool({
					description:
						"最近蓄積された記事を取得する。日数を指定して期間を絞れる。",
					inputSchema: z.object({
						days: z.number().describe("何日前までの記事を取得するか"),
						limit: z.number().describe("取得する記事数の上限"),
					}),
					execute: async ({ days, limit }: { days: number; limit: number }) => {
						const { results } = await db
							.prepare(
								"SELECT title, url, description, published_at, bookmark_count FROM articles WHERE created_at >= datetime('now', '-' || ? || ' days') ORDER BY bookmark_count DESC LIMIT ?",
							)
							.bind(days, limit)
							.all<StoredArticle>();
						return results;
					},
				}),
				searchArticles: tool({
					description: "キーワードで記事を検索する",
					inputSchema: z.object({
						keyword: z.string().describe("検索キーワード"),
						limit: z.number().describe("取得する記事数の上限"),
					}),
					execute: async ({
						keyword,
						limit,
					}: {
						keyword: string;
						limit: number;
					}) => {
						const pattern = `%${keyword}%`;
						const { results } = await db
							.prepare(
								"SELECT title, url, description, published_at, bookmark_count FROM articles WHERE title LIKE ? OR description LIKE ? ORDER BY bookmark_count DESC LIMIT ?",
							)
							.bind(pattern, pattern, limit)
							.all<StoredArticle>();
						return results;
					},
				}),
				getInterests: tool({
					description: "登録されている興味分野の一覧を取得する",
					inputSchema: z.object({}),
					execute: async () => {
						const { results } = await db
							.prepare("SELECT keyword, description FROM interests")
							.all<Interest>();
						return results;
					},
				}),
				getStats: tool({
					description: "蓄積された記事の統計情報を取得する",
					inputSchema: z.object({}),
					execute: async () => {
						const total = await db
							.prepare("SELECT COUNT(*) as count FROM articles")
							.first<{ count: number }>();
						const recent = await db
							.prepare(
								"SELECT COUNT(*) as count FROM articles WHERE created_at >= datetime('now', '-1 days')",
							)
							.first<{ count: number }>();
						const lastCrawl = await db
							.prepare(
								"SELECT crawled_at, articles_found, articles_new FROM crawl_log ORDER BY id DESC LIMIT 1",
							)
							.first<{
								crawled_at: string;
								articles_found: number;
								articles_new: number;
							}>();
						return {
							totalArticles: total?.count ?? 0,
							last24hArticles: recent?.count ?? 0,
							lastCrawl: lastCrawl ?? null,
						};
					},
				}),
			},
			stopWhen: stepCountIs(5),
			abortSignal: options?.abortSignal,
		});

		return result.toUIMessageStreamResponse();
	}

	@callable()
	async addInterest(keyword: string, description = "") {
		const id = crypto.randomUUID();
		await this.env.DB.prepare(
			"INSERT OR IGNORE INTO interests (id, keyword, description) VALUES (?, ?, ?)",
		)
			.bind(id, keyword, description)
			.run();
		return { id, keyword, description };
	}

	@callable()
	async removeInterest(keyword: string) {
		await this.env.DB.prepare("DELETE FROM interests WHERE keyword = ?")
			.bind(keyword)
			.run();
		return { removed: keyword };
	}

	@callable()
	async listInterests() {
		const { results } = await this.env.DB.prepare(
			"SELECT keyword, description FROM interests",
		).all<Interest>();
		return results;
	}

	@callable()
	async triggerCrawl() {
		await this.crawl();
		return { status: "completed" };
	}
}
