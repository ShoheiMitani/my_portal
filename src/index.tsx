import { Hono } from "hono";
import { agentsMiddleware } from "hono-agents";
import { crawlAllChannels } from "./agent/crawl";
import {
	extractUrls,
	notifySlackThread,
	processSlackUrls,
	verifySlackSignature,
} from "./agent/slack";
import { parsePeriod } from "./agent/topics";
import type { Env } from "./agent/types";
import { fetchHatenaBlog, fetchSpeakerDeck } from "./lib/feeds";

export { TrendCollectorAgent } from "./agent/trend-collector";

export const app = new Hono<{ Bindings: Env }>();
const WEEKLY_TOPIC_UTC_DAY = 1; // Monday

function getTopicGeneratorStub(env: Env) {
	const id = env.TrendCollector.idFromName("topic-generator");
	return env.TrendCollector.get(id);
}

app.use("*", agentsMiddleware());

app.get("/api/feeds/blog", async (c) => {
	const entries = await fetchHatenaBlog().catch(() => []);
	return c.json(entries);
});

app.get("/api/feeds/slides", async (c) => {
	const entries = await fetchSpeakerDeck().catch(() => []);
	return c.json(entries);
});

app.post("/api/crawl", async (c) => {
	const results = await crawlAllChannels(c.env.DB, c.env);
	return c.json(results);
});

app.get("/api/topics", async (c) => {
	const period = parsePeriod(c.req.query("period") ?? "daily");
	if (!period) {
		return c.json({ error: "period must be 'daily' or 'weekly'" }, 400);
	}
	const { results: topics } = await c.env.DB.prepare(
		`SELECT t.id, t.title, t.summary, t.source_count, t.period_type,
		        t.generated_at, t.period_start, t.period_end,
		        p.preference
		 FROM topics t
		 LEFT JOIN topic_preferences p ON p.topic_title = t.title
		 WHERE t.period_type = ?
		 ORDER BY CASE
		            WHEN p.preference = 'like' THEN 0
		            WHEN p.preference = 'dislike'
		                 OR (p.preference IS NULL AND t.demoted = 1) THEN 2
		            ELSE 1
		          END,
		          t.source_count DESC`,
	)
		.bind(period)
		.all();
	return c.json(topics);
});

app.post("/api/topics/:id/preference", async (c) => {
	const body = await c.req
		.json<{ preference?: string }>()
		.catch(() => ({}) as { preference?: string });
	const preference = body.preference;
	if (preference !== "like" && preference !== "dislike") {
		return c.json({ error: "preference must be 'like' or 'dislike'" }, 400);
	}

	const topic = await c.env.DB.prepare(
		"SELECT title, summary, category FROM topics WHERE id = ?",
	)
		.bind(c.req.param("id"))
		.first<{ title: string; summary: string; category: string }>();
	if (!topic) return c.json({ error: "not found" }, 404);

	// トピックは再生成のたびに消えるため、内容のスナップショットを保存する
	await c.env.DB.prepare(
		`INSERT INTO topic_preferences (id, preference, topic_title, topic_summary, category)
		 VALUES (?, ?, ?, ?, ?)
		 ON CONFLICT(topic_title) DO UPDATE SET
		   preference = excluded.preference,
		   topic_summary = excluded.topic_summary,
		   category = excluded.category,
		   created_at = datetime('now')`,
	)
		.bind(
			crypto.randomUUID(),
			preference,
			topic.title,
			topic.summary,
			topic.category,
		)
		.run();
	return c.json({ ok: true, preference });
});

app.delete("/api/topics/:id/preference", async (c) => {
	const topic = await c.env.DB.prepare("SELECT title FROM topics WHERE id = ?")
		.bind(c.req.param("id"))
		.first<{ title: string }>();
	if (!topic) return c.json({ error: "not found" }, 404);

	// 好みの削除と同時に、その好みが原因で立っていた降格フラグも解除する
	// （類似タイトルによる間接的な降格は次回の再生成時に再計算される）
	await c.env.DB.batch([
		c.env.DB.prepare(
			"DELETE FROM topic_preferences WHERE topic_title = ?",
		).bind(topic.title),
		c.env.DB.prepare("UPDATE topics SET demoted = 0 WHERE title = ?").bind(
			topic.title,
		),
	]);
	return c.json({ ok: true });
});

app.post("/api/topics/generate", async (c) => {
	const body = (await c.req
		.json<{ period?: string; force?: boolean }>()
		.catch(() => ({}))) as {
		period?: string;
		force?: boolean;
	};
	const period = parsePeriod(body.period ?? "daily");
	if (!period) {
		return c.json({ error: "period must be 'daily' or 'weekly'" }, 400);
	}
	console.log(`[api] POST /api/topics/generate: period=${period}`);
	const stub = getTopicGeneratorStub(c.env);
	const res = await stub.fetch(
		new Request("http://do/generate", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ periods: [period], force: body.force }),
		}),
	);
	const data = await res.json();
	console.log("[api] DO response:", JSON.stringify(data));
	return c.json(data);
});

app.get("/api/topics/status", async (c) => {
	const stub = getTopicGeneratorStub(c.env);
	const res = await stub.fetch(new Request("http://do/status"));
	return c.json(await res.json());
});

app.post("/api/slack/events", async (c) => {
	const body = await c.req.text();
	const timestamp = c.req.header("X-Slack-Request-Timestamp") ?? "";
	const signature = c.req.header("X-Slack-Signature") ?? "";

	let payload: {
		type: string;
		challenge?: string;
		event?: {
			type: string;
			text?: string;
			bot_id?: string;
			channel?: string;
			ts?: string;
		};
	};
	try {
		payload = JSON.parse(body);
	} catch {
		return c.json({ error: "invalid JSON" }, 400);
	}

	// url_verificationはsigning secretの設定前に来る可能性があるので先に処理
	if (payload.type === "url_verification") {
		return c.json({ challenge: payload.challenge });
	}

	const valid = await verifySlackSignature(
		c.env.SLACK_SIGNING_SECRET,
		timestamp,
		body,
		signature,
	);
	if (!valid) {
		return c.json({ error: "invalid signature" }, 401);
	}

	if (payload.type === "event_callback" && payload.event?.type === "message") {
		if (payload.event.bot_id) {
			return c.json({ ok: true });
		}

		const urls = extractUrls(payload.event.text ?? "");
		const eventChannel = payload.event.channel;
		const eventTs = payload.event.ts;
		if (urls.length > 0) {
			const task = processSlackUrls(c.env.DB, urls)
				.then((result) => {
					if (eventChannel != null && eventTs != null) {
						return notifySlackThread(
							c.env.SLACK_BOT_TOKEN,
							eventChannel,
							eventTs,
							result,
						);
					}
				})
				.catch((e) => {
					console.error("[slack] error:", e);
				});
			c.executionCtx.waitUntil(task);
		}
	}

	return c.json({ ok: true });
});

app.get("/api/articles", async (c) => {
	const source = c.req.query("source");
	const limit = Number(c.req.query("limit") ?? "50");
	const offset = Number(c.req.query("offset") ?? "0");

	let whereClause = "";
	const bindParams: unknown[] = [];

	if (source === "slack") {
		whereClause = "AND ch.channel_type = ?";
		bindParams.push("slack");
	} else if (source === "crawler") {
		whereClause = "AND ch.channel_type IN (?, ?, ?)";
		bindParams.push("rss", "atom", "note_api");
	} else if (source === "x_bookmarks") {
		whereClause = "AND ch.channel_type = ?";
		bindParams.push("x_bookmarks");
	}

	bindParams.push(limit, offset);

	const { results } = await c.env.DB.prepare(
		`SELECT a.id, a.url, a.title, a.description, a.content_type,
		        a.published_at, a.created_at,
		        MAX(ch.name) as channel_name, MAX(ch.channel_type) as channel_type
		 FROM articles a
		 LEFT JOIN collection_items ci ON a.id = ci.article_id
		 LEFT JOIN collection_runs cr ON ci.collection_run_id = cr.id
		 LEFT JOIN channels ch ON cr.channel_id = ch.id
		 WHERE 1=1 ${whereClause}
		 GROUP BY a.id
		 ORDER BY a.created_at DESC
		 LIMIT ? OFFSET ?`,
	)
		.bind(...bindParams)
		.all();

	return c.json(results);
});

app.get("/api/topics/:id", async (c) => {
	const topicId = c.req.param("id");
	const topic = await c.env.DB.prepare(
		`SELECT t.id, t.title, t.summary, t.source_count, t.period_type,
		        t.generated_at, p.preference
		 FROM topics t
		 LEFT JOIN topic_preferences p ON p.topic_title = t.title
		 WHERE t.id = ?`,
	)
		.bind(topicId)
		.first();
	if (!topic) return c.json({ error: "not found" }, 404);

	const { results: articles } = await c.env.DB.prepare(
		`SELECT a.id, a.title, a.url, a.description, a.published_at,
		        ch.name as channel_name
		 FROM topic_items ti
		 JOIN articles a ON ti.article_id = a.id
		 LEFT JOIN collection_items ci ON a.id = ci.article_id
		 LEFT JOIN collection_runs cr ON ci.collection_run_id = cr.id
		 LEFT JOIN channels ch ON cr.channel_id = ch.id
		 WHERE ti.topic_id = ?
		 GROUP BY a.id
		 ORDER BY a.published_at DESC`,
	)
		.bind(topicId)
		.all();

	return c.json({ ...topic, articles });
});

export default {
	fetch: app.fetch,
	async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
		ctx.waitUntil(
			crawlAllChannels(env.DB, env)
				.then(async (results) => {
					console.log("Crawl results:", JSON.stringify(results));
					const hasNew = results.some((r) => r.articlesNew > 0);
					if (!hasNew) return;

					const periods = ["daily"];
					const day = new Date().getUTCDay();
					if (day === WEEKLY_TOPIC_UTC_DAY) periods.push("weekly");

					const stub = getTopicGeneratorStub(env);
					await stub.fetch(
						new Request("http://do/generate", {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({ periods }),
						}),
					);
				})
				.catch((e) => {
					console.error("Scheduled task error:", e);
				}),
		);
	},
};
