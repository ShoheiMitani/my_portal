import type { Env } from "./types";

type PeriodType = "daily" | "weekly";

const VALID_PERIODS: readonly string[] = ["daily", "weekly"];

export function parsePeriod(value: unknown): PeriodType | null {
	return VALID_PERIODS.includes(value as string) ? (value as PeriodType) : null;
}

interface ArticleForGrouping {
	id: string;
	title: string;
	description: string;
	url: string;
	published_at: string | null;
}

interface TopicGroup {
	title: string;
	summary: string;
	article_ids: string[];
}

/** ステージ1: 記事ごとのアノテーション結果 */
interface ArticleAnnotation {
	id: string;
	category: string;
	summary: string;
}

/** カテゴリごとにまとめた記事群 */
interface CategoryGroup {
	category: string;
	articles: { id: string; summary: string }[];
}

const PERIOD_DAYS: Record<PeriodType, number> = {
	daily: 1,
	weekly: 7,
};

const MIN_ARTICLES_PER_TOPIC = 2;
const CHUNK_SIZE = 10;
const MAX_CATEGORY_SIZE = 15;
const MAX_CONCURRENCY = 3;
const AI_MODEL = "@cf/openai/gpt-oss-120b" as const;

// ─── ユーティリティ ────────────────────────────────────

export function splitIntoChunks<T>(items: T[], size: number): T[][] {
	if (items.length === 0) return [];
	const chunks: T[][] = [];
	for (let i = 0; i < items.length; i += size) {
		chunks.push(items.slice(i, i + size));
	}
	return chunks;
}

/**
 * リトライ付きで非同期関数を実行する
 */
async function withRetry<T>(
	fn: () => Promise<T>,
	retries: number,
	delayMs: number,
): Promise<T> {
	for (let attempt = 0; attempt <= retries; attempt++) {
		try {
			return await fn();
		} catch (e) {
			if (attempt === retries) throw e;
			console.log(
				`[topics] retrying after error (attempt ${attempt + 1}/${retries}): ${e}`,
			);
			await new Promise((r) => setTimeout(r, delayMs));
		}
	}
	throw new Error("unreachable");
}

/**
 * 最大同時実行数を制限しながらPromiseを実行する（直列バッチ）
 */
async function runWithConcurrency<T>(
	tasks: (() => Promise<T>)[],
	concurrency: number,
): Promise<T[]> {
	const results: T[] = [];
	for (let i = 0; i < tasks.length; i += concurrency) {
		const batch = tasks.slice(i, i + concurrency);
		const batchResults = await Promise.all(batch.map((fn) => fn()));
		results.push(...batchResults);
	}
	return results;
}

export function groupByCategory(
	annotations: ArticleAnnotation[],
): CategoryGroup[] {
	const map = new Map<string, { id: string; summary: string }[]>();
	for (const a of annotations) {
		const existing = map.get(a.category);
		if (existing) {
			existing.push({ id: a.id, summary: a.summary });
		} else {
			map.set(a.category, [{ id: a.id, summary: a.summary }]);
		}
	}
	return Array.from(map.entries()).map(([category, articles]) => ({
		category,
		articles,
	}));
}

// ─── DB操作 ────────────────────────────────────────────

async function fetchArticlesForGrouping(
	db: D1Database,
	periodType: PeriodType,
): Promise<ArticleForGrouping[]> {
	const days = PERIOD_DAYS[periodType];
	const { results } = await db
		.prepare(
			`SELECT id, title, description, url, published_at
			 FROM articles
			 WHERE created_at >= datetime('now', '-' || ? || ' days')
			 ORDER BY created_at DESC`,
		)
		.bind(days)
		.all<ArticleForGrouping>();
	return results;
}

async function saveTopics(
	db: D1Database,
	topics: TopicGroup[],
	periodType: PeriodType,
	periodStart: string,
	periodEnd: string,
): Promise<void> {
	if (topics.length === 0) return;

	const insertStmts: D1PreparedStatement[] = [
		db
			.prepare(
				"DELETE FROM topic_items WHERE topic_id IN (SELECT id FROM topics WHERE period_type = ?)",
			)
			.bind(periodType),
		db.prepare("DELETE FROM topics WHERE period_type = ?").bind(periodType),
	];

	for (const topic of topics) {
		const topicId = crypto.randomUUID();
		insertStmts.push(
			db
				.prepare(
					"INSERT INTO topics (id, title, summary, source_count, period_type, period_start, period_end) VALUES (?, ?, ?, ?, ?, ?, ?)",
				)
				.bind(
					topicId,
					topic.title,
					topic.summary,
					topic.article_ids.length,
					periodType,
					periodStart,
					periodEnd,
				),
		);
		for (const articleId of topic.article_ids) {
			insertStmts.push(
				db
					.prepare(
						"INSERT OR IGNORE INTO topic_items (id, topic_id, article_id) VALUES (?, ?, ?)",
					)
					.bind(crypto.randomUUID(), topicId, articleId),
			);
		}
	}

	await db.batch(insertStmts);
}

// ─── Workers AI レスポンスのパース ─────────────────────

/** Responses API の output 配列からメッセージテキストを抽出する */
function extractTextFromResponsesApi(output: unknown[]): string | null {
	const texts: string[] = [];
	for (const block of output) {
		if (typeof block !== "object" || block === null) continue;
		const b = block as Record<string, unknown>;
		if (b.type !== "message" || !Array.isArray(b.content)) continue;
		for (const part of b.content as unknown[]) {
			if (typeof part !== "object" || part === null) continue;
			const p = part as Record<string, unknown>;
			if (typeof p.text === "string") {
				texts.push(p.text);
			}
		}
	}
	return texts.length > 0 ? texts.join("") : null;
}

function extractAIResponse(response: unknown): {
	text: string;
	parsed: unknown[] | null;
} {
	if (typeof response !== "object" || response === null) {
		return { text: "", parsed: null };
	}
	const resp = response as Record<string, unknown>;

	// Responses API: output_text が最も軽量なのでまず確認
	if (typeof resp.output_text === "string") {
		return { text: resp.output_text, parsed: null };
	}

	// Responses API: output_text がない場合は output 配列からテキスト抽出
	if (Array.isArray(resp.output)) {
		const text = extractTextFromResponsesApi(resp.output);
		if (text) return { text, parsed: null };
	}

	// 従来の Workers AI 形式: { response: "..." }
	const raw = resp.response;
	if (Array.isArray(raw)) return { text: "", parsed: raw };
	if (typeof raw === "string") return { text: raw, parsed: null };
	return { text: "", parsed: null };
}

function normalizeToJson(str: string): string {
	let s = str;
	if (s.includes("'") && !s.includes('"')) {
		s = s.replace(/'/g, '"');
	}
	s = s.replace(/(\s)([\w]+)\s*:/g, '$1"$2":');
	return s;
}

function extractJsonArray(text: string): unknown[] | null {
	const lastClose = text.lastIndexOf("]");
	if (lastClose === -1) return null;
	let depth = 0;
	let firstOpen = -1;
	for (let i = lastClose; i >= 0; i--) {
		if (text[i] === "]") depth++;
		if (text[i] === "[") depth--;
		if (depth === 0) {
			firstOpen = i;
			break;
		}
	}
	if (firstOpen === -1) return null;

	const jsonStr = normalizeToJson(text.slice(firstOpen, lastClose + 1));
	try {
		const parsed = JSON.parse(jsonStr);
		return Array.isArray(parsed) ? parsed : null;
	} catch {
		return null;
	}
}

function parseAIItems(response: unknown): unknown[] | null {
	const { text, parsed } = extractAIResponse(response);
	return parsed ?? extractJsonArray(text);
}

// ─── バリデーション ───────────────────────────────────

function validateTopicGroups(
	items: unknown[],
	validIds: Set<string>,
): TopicGroup[] {
	return items
		.filter(
			(
				item,
			): item is { title: string; summary: string; article_ids: string[] } =>
				typeof item === "object" &&
				item !== null &&
				typeof (item as Record<string, unknown>).title === "string" &&
				typeof (item as Record<string, unknown>).summary === "string" &&
				Array.isArray((item as Record<string, unknown>).article_ids),
		)
		.map((item) => ({
			title: item.title,
			summary: item.summary,
			article_ids: item.article_ids.filter((id) => validIds.has(id)),
		}))
		.filter((item) => item.article_ids.length >= MIN_ARTICLES_PER_TOPIC);
}

function validateAnnotations(items: unknown[]): ArticleAnnotation[] {
	return items
		.filter(
			(item): item is { id: string; category: string; summary: string } =>
				typeof item === "object" &&
				item !== null &&
				typeof (item as Record<string, unknown>).id === "string" &&
				typeof (item as Record<string, unknown>).category === "string" &&
				typeof (item as Record<string, unknown>).summary === "string",
		)
		.map((item) => ({
			id: item.id,
			category: item.category,
			summary: item.summary,
		}));
}

export function parseLLMResponse(
	text: string,
	articles: ArticleForGrouping[],
): TopicGroup[] {
	const validIds = new Set(articles.map((a) => a.id));
	const parsed = extractJsonArray(text);
	if (!parsed) return [];
	return validateTopicGroups(parsed, validIds);
}

// ─── ステージ1: 記事アノテーション（要約+カテゴリ付与）─

function buildAnnotationPrompt(articles: ArticleForGrouping[]): string {
	const articleList = articles
		.map((a, i) => {
			const desc = a.description ? `\n   ${a.description}` : "";
			return `${i + 1}. [id:${a.id}] ${a.title}${desc}`;
		})
		.join("\n");

	return `以下の各記事について、要約とカテゴリを付与してください。

## ルール
- summaryは記事の中心的な話題を2〜3文で具体的に説明してください。固有名詞・数字・技術名を含めてください
- categoryは大まかな分類です（例: AI, Rails, セキュリティ, インフラ, 開発ツール, ビジネス, etc）
- 同じ話題の記事には同じcategoryを使ってください

## 記事リスト
${articleList}

## 出力フォーマット
以下のJSON配列のみを出力してください。
[{"id": "記事のid", "category": "カテゴリ", "summary": "要約"}]`;
}

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 3000;

async function annotateChunk(
	ai: Ai,
	articles: ArticleForGrouping[],
): Promise<ArticleAnnotation[]> {
	const prompt = buildAnnotationPrompt(articles);
	const response = await withRetry(
		() =>
			ai.run(AI_MODEL, {
				input: prompt,
				max_output_tokens: 16384,
			}),
		MAX_RETRIES,
		RETRY_DELAY_MS,
	);

	const items = parseAIItems(response);
	if (!items) {
		console.error(
			"[topics] annotation parse failed, raw response:",
			JSON.stringify(response).slice(0, 500),
		);
		return [];
	}

	const validIds = new Set(articles.map((a) => a.id));
	return validateAnnotations(items).filter((a) => validIds.has(a.id));
}

// ─── ステージ2: カテゴリ内の細かいグルーピング+要約 ───

function buildGroupingPrompt(group: CategoryGroup): string {
	const articleList = group.articles
		.map((a, i) => `${i + 1}. [id:${a.id}] ${a.summary}`)
		.join("\n");

	return `以下は「${group.category}」カテゴリの記事の要約一覧です。具体的な出来事・ニュース・議論ごとにグルーピングし、各グループのタイトルと要約を作成してください。

## ルール
- 「AI」「Rails」のような大カテゴリ名をそのままタイトルにしないでください
- タイトルは具体的な出来事を表す端的な表現にしてください（例: 「GPT-5.4 Omni発表」「NVIDIAのAIインフラ投資」）
- 要約は2〜3文で、具体的に何が起きているか・何が議論されているかを説明してください
- 固有名詞や具体的な数字があれば積極的に含めてください
- 「〜に関する記事が複数あります」のような抽象的な表現は避けてください
- 1つの出来事に関する記事が1件しかない場合も、他と無理にまとめずそのまま1グループにしてください

## 記事一覧
${articleList}

## 出力フォーマット
以下のJSON配列のみを出力してください。
[{"title": "トピックタイトル", "summary": "要約", "article_ids": ["記事のid", ...]}]`;
}

async function groupWithinCategory(
	ai: Ai,
	group: CategoryGroup,
	allValidIds: Set<string>,
): Promise<TopicGroup[]> {
	// 記事が1件以下のカテゴリはスキップ
	if (group.articles.length < MIN_ARTICLES_PER_TOPIC) return [];

	const prompt = buildGroupingPrompt(group);
	const response = await withRetry(
		() =>
			ai.run(AI_MODEL, {
				input: prompt,
				max_output_tokens: 16384,
			}),
		MAX_RETRIES,
		RETRY_DELAY_MS,
	);

	const items = parseAIItems(response);
	if (!items) {
		console.error(
			`[topics] grouping parse failed for "${group.category}", raw response:`,
			JSON.stringify(response).slice(0, 500),
		);
		return [];
	}
	return validateTopicGroups(items, allValidIds);
}

// ─── パイプライン本体 ─────────────────────────────────

async function runPipeline(
	ai: Ai,
	articles: ArticleForGrouping[],
	_periodType: PeriodType,
): Promise<TopicGroup[]> {
	if (articles.length === 0) return [];

	// ステージ1: チャンク分割 → 同時実行数を制限してアノテーション
	const chunks = splitIntoChunks(articles, CHUNK_SIZE);
	console.log(
		`[topics] stage1: annotating ${articles.length} articles in ${chunks.length} chunks (concurrency=${MAX_CONCURRENCY})...`,
	);

	const chunkAnnotations = await runWithConcurrency(
		chunks.map(
			(chunk) => () =>
				annotateChunk(ai, chunk).catch((e) => {
					console.error("[topics] annotation failed:", e);
					return [] as ArticleAnnotation[];
				}),
		),
		MAX_CONCURRENCY,
	);
	const annotations = chunkAnnotations.flat();
	console.log(
		`[topics] stage1 done: ${annotations.length}/${articles.length} articles annotated`,
	);
	if (annotations.length === 0) return [];

	// カテゴリごとにグルーピング
	const categoryGroups = groupByCategory(annotations);
	console.log(
		`[topics] categories: ${categoryGroups.map((g) => `${g.category}(${g.articles.length})`).join(", ")}`,
	);

	// 大きすぎるカテゴリを分割
	const groupingTasks: CategoryGroup[] = [];
	for (const group of categoryGroups) {
		if (group.articles.length > MAX_CATEGORY_SIZE) {
			const subChunks = splitIntoChunks(group.articles, MAX_CATEGORY_SIZE);
			for (let i = 0; i < subChunks.length; i++) {
				groupingTasks.push({
					category: `${group.category}(${i + 1}/${subChunks.length})`,
					articles: subChunks[i],
				});
			}
		} else {
			groupingTasks.push(group);
		}
	}

	// ステージ2: カテゴリ内で細かいトピック分割+要約（同時実行数制限）
	console.log(
		`[topics] stage2: grouping ${groupingTasks.length} category groups (concurrency=${MAX_CONCURRENCY})...`,
	);
	const allValidIds = new Set(articles.map((a) => a.id));

	const topicResults = await runWithConcurrency(
		groupingTasks.map(
			(group) => () =>
				groupWithinCategory(ai, group, allValidIds).catch((e) => {
					console.error(`[topics] grouping failed for "${group.category}":`, e);
					return [] as TopicGroup[];
				}),
		),
		MAX_CONCURRENCY,
	);

	const topics = topicResults.flat();
	console.log(`[topics] stage2 done: ${topics.length} topics generated`);
	return topics;
}

// ─── エントリーポイント ───────────────────────────────

export async function generateTopics(
	env: Env,
	periodType: PeriodType,
): Promise<{ topicCount: number; articleCount: number }> {
	console.log(`[topics] ${periodType}: fetching articles...`);
	const articles = await fetchArticlesForGrouping(env.DB, periodType);
	if (articles.length === 0) {
		console.log(`[topics] ${periodType}: no articles found, skipping`);
		return { topicCount: 0, articleCount: 0 };
	}
	console.log(
		`[topics] ${periodType}: ${articles.length} articles found, starting pipeline...`,
	);

	const topics = await runPipeline(env.AI, articles, periodType);
	console.log(`[topics] ${periodType}: ${topics.length} topics generated`);

	const now = new Date().toISOString();
	const days = PERIOD_DAYS[periodType];
	const periodStart = new Date(
		Date.now() - days * 24 * 60 * 60 * 1000,
	).toISOString();

	await saveTopics(env.DB, topics, periodType, periodStart, now);
	console.log(`[topics] ${periodType}: saved to DB`);

	return {
		topicCount: topics.length,
		articleCount: articles.length,
	};
}
