import { AIChatAgent } from "@cloudflare/ai-chat";
import type { OnChatMessageOptions } from "@cloudflare/ai-chat";
import { convertToModelMessages, stepCountIs, streamText, tool } from "ai";
import { createWorkersAI } from "workers-ai-provider";
import { z } from "zod/v4";
import { decodeHtmlEntities } from "../lib/xml";
import { USER_AGENT, crawlAllChannels } from "./crawl";
import { generateTopics } from "./topics";
import type { Env } from "./types";

const MAX_ARTICLES = 30;
const MAX_CONTENT_LENGTH = 3000;
const MAX_HTML_SIZE = 5_000_000;

function isAllowedUrl(url: string): boolean {
	try {
		const parsed = new URL(url);
		return parsed.protocol === "https:" || parsed.protocol === "http:";
	} catch {
		return false;
	}
}

async function fetchArticleContent(url: string): Promise<string> {
	if (!isAllowedUrl(url)) return "取得失敗: 許可されていないURLスキームです";
	const res = await fetch(url, {
		headers: { "User-Agent": USER_AGENT },
		redirect: "follow",
	});
	if (!res.ok) return `取得失敗: HTTP ${res.status}`;
	const html = await res.text();
	if (html.length > MAX_HTML_SIZE)
		return "取得失敗: レスポンスサイズが大きすぎます";
	const text = decodeHtmlEntities(
		html
			.replace(/<script[\s\S]*?<\/script>/gi, "")
			.replace(/<style[\s\S]*?<\/style>/gi, "")
			.replace(/<[^>]+>/g, " ")
			.replace(/&nbsp;/g, " ")
			.replace(/\s+/g, " ")
			.trim(),
	);
	if (text.length > MAX_CONTENT_LENGTH) {
		return `${text.slice(0, MAX_CONTENT_LENGTH)}…（以下省略）`;
	}
	return text;
}

function escapeLike(keyword: string): string {
	return keyword.replace(/[%_]/g, (c) => `\\${c}`);
}

interface ArticleRow {
	title: string;
	url: string;
	description: string;
	content: string;
	content_type: string;
	published_at: string;
	metadata: string;
	created_at: string;
	channel_name?: string;
}

const CONTENT_SUMMARY_LENGTH = 500;

function formatArticles(articles: ArticleRow[]): string {
	if (articles.length === 0) return "記事が見つかりませんでした。";
	return articles
		.map((a, i) => {
			const meta = JSON.parse(a.metadata || "{}");
			const lines = [`${i + 1}. 「${a.title}」`];
			lines.push(`   URL: ${a.url}`);
			if (a.published_at) lines.push(`   公開日: ${a.published_at}`);
			if (a.channel_name) lines.push(`   チャネル: ${a.channel_name}`);
			if (a.content_type) lines.push(`   種別: ${a.content_type}`);
			if (meta.bookmark_count != null)
				lines.push(`   ブックマーク: ${meta.bookmark_count}users`);
			if (a.description) lines.push(`   概要: ${a.description}`);
			if (a.content) {
				const summary =
					a.content.length > CONTENT_SUMMARY_LENGTH
						? `${a.content.slice(0, CONTENT_SUMMARY_LENGTH)}…`
						: a.content;
				lines.push(`   本文: ${summary}`);
			}
			return lines.join("\n");
		})
		.join("\n\n");
}

interface GenerationState {
	status: "idle" | "running" | "done" | "error";
	periods?: string[];
	result?: { period: string; topicCount: number; articleCount: number }[];
	error?: string;
	startedAt?: number;
}

const STALE_TIMEOUT_MS = 15 * 60 * 1000; // 15分

export class TrendCollectorAgent extends AIChatAgent<Env> {
	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		console.log(`[DO] fetch: ${request.method} ${url.pathname}`);

		if (url.pathname === "/generate" && request.method === "POST") {
			const body = (await request.json()) as {
				periods?: string[];
				force?: boolean;
			};
			const current = await this.ctx.storage.get<GenerationState>("genState");
			if (current?.status === "running") {
				if (body.force) {
					console.log("[DO] force reset requested");
				} else {
					const isStale =
						!current.startedAt ||
						Date.now() - current.startedAt > STALE_TIMEOUT_MS;
					if (!isStale) {
						return Response.json({ status: "already_running" });
					}
					console.log("[DO] stale running state detected, resetting");
				}
			}
			const periods = body.periods ?? ["daily"];
			await this.ctx.storage.put<GenerationState>("genState", {
				status: "running",
				periods,
				startedAt: Date.now(),
			});
			await this.ctx.storage.setAlarm(Date.now() + 100);
			return Response.json({ status: "started", periods });
		}

		if (url.pathname === "/status") {
			const state = await this.ctx.storage.get<GenerationState>("genState");
			if (
				state?.status === "running" &&
				state.startedAt &&
				Date.now() - state.startedAt > STALE_TIMEOUT_MS
			) {
				const reset: GenerationState = {
					status: "error",
					error: "timeout: alarm did not complete within 15 minutes",
				};
				await this.ctx.storage.put<GenerationState>("genState", reset);
				console.log("[DO] auto-reset stale running state on status check");
				return Response.json(reset);
			}
			return Response.json(state ?? { status: "idle" });
		}

		return super.fetch(request);
	}

	async alarm() {
		console.log("[DO] alarm fired");
		const state = await this.ctx.storage.get<GenerationState>("genState");
		if (!state || state.status !== "running") return;

		const results: {
			period: string;
			topicCount: number;
			articleCount: number;
		}[] = [];

		try {
			for (const period of state.periods ?? []) {
				console.log(`[alarm] generating topics for ${period}...`);
				const result = await generateTopics(
					this.env,
					period as "daily" | "weekly",
				);
				results.push({ period, ...result });
			}
			await this.ctx.storage.put<GenerationState>("genState", {
				status: "done",
				periods: state.periods,
				result: results,
			});
			console.log("[alarm] topic generation done:", JSON.stringify(results));
		} catch (e) {
			console.error("[alarm] topic generation failed:", e);
			await this.ctx.storage.put<GenerationState>("genState", {
				status: "error",
				periods: state.periods,
				error: String(e),
			});
		}
	}

	async onChatMessage(
		onFinish: Parameters<AIChatAgent["onChatMessage"]>[0],
		options?: OnChatMessageOptions,
	) {
		const db = this.env.DB;
		const workersai = createWorkersAI({ binding: this.env.AI });

		const result = streamText({
			model: workersai("@cf/openai/gpt-oss-120b", {
				reasoning_effort: "none",
			}),
			system: `あなたはテックトレンド分析アシスタントです。
蓄積された記事を横断的に分析し、世の中のトレンドや議論の流れを解説します。

## あなたの役割
- 複数の記事から読み取れるトレンドや議論の方向性をまとめる
- 「世の中で何が話題になっているか」「どんな議論が起きているか」を俯瞰的に伝える
- 具体的な記事URLは参考として示すが、あくまでトレンドの説明を主軸にする

## 重要：記事情報の正確性
- 記事のタイトルは必ずツールの結果からそのまま正確に引用すること。タイトルを要約・改変・翻訳・創作しないこと。
- URLもツールの結果をそのまま使うこと。存在しないURLを生成しないこと。
- ツールの結果に含まれない記事を捏造しないこと。

## 回答スタイル
- 簡潔に回答すること。冗長な前置きや繰り返しは不要。
- 記事一覧を求められた場合は、番号付きリストで簡潔に示す。マークダウンテーブルは使わない。

## ツール使い分け
- 最近の記事を見たい → getRecentArticles
- キーワードで検索 → searchArticles
- チャネル別に見たい → getArticlesByChannel
- コンテンツ種別で絞りたい → getArticlesByType
- 統計を知りたい → getStats
- チャネル一覧を見たい → listChannels
- 記事の本文を読みたい → readArticle
- 最新記事を取得したい → triggerCrawl
- トピックを再生成したい → regenerateTopics`,
			messages: await convertToModelMessages(this.messages),
			tools: {
				getRecentArticles: tool({
					description:
						"最近蓄積された記事を取得する。日数を指定して期間を絞れる。",
					inputSchema: z.object({
						days: z.number().describe("何日前までの記事を取得するか"),
						limit: z
							.number()
							.optional()
							.describe("取得する記事数の上限（デフォルト20）"),
					}),
					execute: async ({
						days,
						limit,
					}: {
						days: number;
						limit?: number;
					}) => {
						const cap = Math.min(limit ?? 20, MAX_ARTICLES);
						const { results } = await db
							.prepare(
								`SELECT a.title, a.url, a.description, SUBSTR(a.content, 1, 501) as content, a.content_type, a.published_at, a.metadata, a.created_at, ch.name as channel_name
								 FROM articles a
								 LEFT JOIN collection_items ci ON a.id = ci.article_id
								 LEFT JOIN collection_runs cr ON ci.collection_run_id = cr.id
								 LEFT JOIN channels ch ON cr.channel_id = ch.id
								 WHERE a.created_at >= datetime('now', '-' || ? || ' days')
								 GROUP BY a.id
								 ORDER BY a.created_at DESC LIMIT ?`,
							)
							.bind(days, cap)
							.all<ArticleRow>();
						return formatArticles(results);
					},
				}),
				searchArticles: tool({
					description:
						"キーワードで記事を検索する。タイトルと説明文を対象に検索する。",
					inputSchema: z.object({
						keyword: z.string().describe("検索キーワード"),
						limit: z
							.number()
							.optional()
							.describe("取得する記事数の上限（デフォルト20）"),
					}),
					execute: async ({
						keyword,
						limit,
					}: {
						keyword: string;
						limit?: number;
					}) => {
						const cap = Math.min(limit ?? 20, MAX_ARTICLES);
						const pattern = `%${escapeLike(keyword)}%`;
						const { results } = await db
							.prepare(
								`SELECT a.title, a.url, a.description, SUBSTR(a.content, 1, 501) as content, a.content_type, a.published_at, a.metadata, a.created_at, ch.name as channel_name
								 FROM articles a
								 LEFT JOIN collection_items ci ON a.id = ci.article_id
								 LEFT JOIN collection_runs cr ON ci.collection_run_id = cr.id
								 LEFT JOIN channels ch ON cr.channel_id = ch.id
								 WHERE a.title LIKE ? ESCAPE '\\' OR a.description LIKE ? ESCAPE '\\'
								 GROUP BY a.id
								 ORDER BY a.created_at DESC LIMIT ?`,
							)
							.bind(pattern, pattern, cap)
							.all<ArticleRow>();
						return formatArticles(results);
					},
				}),
				getArticlesByChannel: tool({
					description:
						"特定のチャネル（情報源）の記事を取得する。チャネル名の一部で絞り込める。",
					inputSchema: z.object({
						channelName: z
							.string()
							.describe(
								"チャネル名（部分一致）。例: 'はてな', 'OpenAI', 'DHH', 'Rails'",
							),
						days: z
							.number()
							.optional()
							.describe("何日前までの記事を取得するか（デフォルト: 全期間）"),
						limit: z
							.number()
							.optional()
							.describe("取得する記事数の上限（デフォルト20）"),
					}),
					execute: async ({
						channelName,
						days,
						limit,
					}: {
						channelName: string;
						days?: number;
						limit?: number;
					}) => {
						const cap = Math.min(limit ?? 20, MAX_ARTICLES);
						const channelPattern = `%${escapeLike(channelName)}%`;
						const dateFilter =
							days != null
								? "AND a.created_at >= datetime('now', '-' || ? || ' days')"
								: "";
						const binds =
							days != null
								? [channelPattern, days, cap]
								: [channelPattern, cap];
						const { results } = await db
							.prepare(
								`SELECT a.title, a.url, a.description, SUBSTR(a.content, 1, 501) as content, a.content_type, a.published_at, a.metadata, a.created_at, ch.name as channel_name
								 FROM articles a
								 JOIN collection_items ci ON a.id = ci.article_id
								 JOIN collection_runs cr ON ci.collection_run_id = cr.id
								 JOIN channels ch ON cr.channel_id = ch.id
								 WHERE ch.name LIKE ? ESCAPE '\\' ${dateFilter}
								 GROUP BY a.id
								 ORDER BY a.created_at DESC LIMIT ?`,
							)
							.bind(...binds)
							.all<ArticleRow>();
						return formatArticles(results);
					},
				}),
				getArticlesByType: tool({
					description: "コンテンツ種別で記事を絞り込む。",
					inputSchema: z.object({
						contentType: z
							.enum(["blog", "tweet", "youtube", "newsletter", "news"])
							.describe("コンテンツ種別"),
						days: z
							.number()
							.optional()
							.describe("何日前までの記事を取得するか（デフォルト: 全期間）"),
						limit: z
							.number()
							.optional()
							.describe("取得する記事数の上限（デフォルト20）"),
					}),
					execute: async ({
						contentType,
						days,
						limit,
					}: {
						contentType: string;
						days?: number;
						limit?: number;
					}) => {
						const cap = Math.min(limit ?? 20, MAX_ARTICLES);
						const dateFilter =
							days != null
								? "AND a.created_at >= datetime('now', '-' || ? || ' days')"
								: "";
						const binds =
							days != null ? [contentType, days, cap] : [contentType, cap];
						const { results } = await db
							.prepare(
								`SELECT a.title, a.url, a.description, SUBSTR(a.content, 1, 501) as content, a.content_type, a.published_at, a.metadata, a.created_at
								 FROM articles a
								 WHERE a.content_type = ? ${dateFilter}
								 ORDER BY a.created_at DESC LIMIT ?`,
							)
							.bind(...binds)
							.all<ArticleRow>();
						return formatArticles(results);
					},
				}),
				listChannels: tool({
					description:
						"登録されているチャネル（情報源）の一覧と、各チャネルの記事数を取得する。",
					inputSchema: z.object({}),
					execute: async () => {
						const { results } = await db
							.prepare(
								`SELECT ch.name, ch.slug, ch.channel_type,
								        COUNT(DISTINCT ci.article_id) as article_count,
								        MAX(cr.collected_at) as last_collected_at
								 FROM channels ch
								 LEFT JOIN collection_runs cr ON ch.id = cr.channel_id
								 LEFT JOIN collection_items ci ON cr.id = ci.collection_run_id
								 GROUP BY ch.id
								 ORDER BY article_count DESC`,
							)
							.all<{
								name: string;
								slug: string;
								channel_type: string;
								article_count: number;
								last_collected_at: string | null;
							}>();
						return results
							.map(
								(ch) =>
									`- ${ch.name} (${ch.channel_type}) : ${ch.article_count}件${ch.last_collected_at ? ` / 最終収集: ${ch.last_collected_at}` : ""}`,
							)
							.join("\n");
					},
				}),
				getStats: tool({
					description:
						"蓄積された記事の統計情報を取得する。全体の件数、直近24hの件数、チャネル別の内訳。",
					inputSchema: z.object({}),
					execute: async () => {
						const [totalRes, recentRes, byChannelRes, lastRunRes] =
							await db.batch([
								db.prepare("SELECT COUNT(*) as count FROM articles"),
								db.prepare(
									"SELECT COUNT(*) as count FROM articles WHERE created_at >= datetime('now', '-1 days')",
								),
								db.prepare(
									`SELECT ch.name, COUNT(DISTINCT ci.article_id) as count
								 FROM channels ch
								 LEFT JOIN collection_runs cr ON ch.id = cr.channel_id
								 LEFT JOIN collection_items ci ON cr.id = ci.collection_run_id
								 GROUP BY ch.id ORDER BY count DESC`,
								),
								db.prepare(
									`SELECT cr.collected_at, cr.articles_found, cr.articles_new, ch.name as channel_name
								 FROM collection_runs cr
								 JOIN channels ch ON cr.channel_id = ch.id
								 ORDER BY cr.collected_at DESC LIMIT 5`,
								),
							]);
						return {
							totalArticles:
								(totalRes.results[0] as { count: number } | undefined)?.count ??
								0,
							last24hArticles:
								(recentRes.results[0] as { count: number } | undefined)
									?.count ?? 0,
							byChannel: byChannelRes.results as {
								name: string;
								count: number;
							}[],
							recentRuns: lastRunRes.results as {
								collected_at: string;
								articles_found: number;
								articles_new: number;
								channel_name: string;
							}[],
						};
					},
				}),
				readArticle: tool({
					description:
						"記事のURLを指定して本文を読み取る。DBに保存済みの本文があればそちらを返す。",
					inputSchema: z.object({
						url: z.string().describe("読み取る記事のURL"),
					}),
					execute: async ({ url }: { url: string }) => {
						const row = await db
							.prepare(
								"SELECT title, content, description, published_at, metadata FROM articles WHERE url = ?",
							)
							.bind(url)
							.first<{
								title: string;
								content: string;
								description: string;
								published_at: string;
								metadata: string;
							}>();
						if (row?.content) {
							return `タイトル: ${row.title}\n公開日: ${row.published_at}\n\n${row.content}`;
						}
						return await fetchArticleContent(url);
					},
				}),
				triggerCrawl: tool({
					description: "全チャネルを手動でクロールして最新記事を取得する",
					inputSchema: z.object({}),
					execute: async () => {
						return await crawlAllChannels(db);
					},
				}),
				regenerateTopics: tool({
					description:
						"トレンドトピックを再生成する。記事をグルーピングし直して話題のサマリーを作り直す。",
					inputSchema: z.object({
						period: z
							.enum(["daily", "weekly"])
							.describe("対象期間: daily=直近24時間, weekly=直近1週間"),
					}),
					execute: async ({ period }: { period: "daily" | "weekly" }) => {
						const result = await generateTopics(this.env, period);
						const label = period === "daily" ? "24時間" : "1週間";
						return `${label}のトピックを再生成しました。${result.topicCount}件のトピックを${result.articleCount}件の記事から生成しました。`;
					},
				}),
			},
			maxOutputTokens: 16384,
			stopWhen: stepCountIs(5),
			abortSignal: options?.abortSignal,
			onFinish,
			onStepFinish: (event) => {
				console.log(
					`[TrendCollector] step finished: ${event.finishReason}, tool calls: ${event.toolCalls?.length ?? 0}`,
				);
			},
			onError: (event) => {
				console.error("[TrendCollector] streamText error:", event.error);
			},
		});

		return result.toUIMessageStreamResponse();
	}
}
