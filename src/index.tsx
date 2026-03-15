import { Hono } from "hono";
import { agentsMiddleware } from "hono-agents";
import { crawlAllChannels } from "./agent/crawl";
import { parsePeriod } from "./agent/topics";
import type { Env } from "./agent/types";
import { fetchHatenaBlog, fetchSpeakerDeck } from "./lib/feeds";

export { TrendCollectorAgent } from "./agent/trend-collector";

export const app = new Hono<{ Bindings: Env }>();

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
	const results = await crawlAllChannels(c.env.DB);
	return c.json(results);
});

app.get("/api/topics", async (c) => {
	const period = parsePeriod(c.req.query("period") ?? "daily");
	if (!period) {
		return c.json({ error: "period must be 'daily' or 'weekly'" }, 400);
	}
	const { results: topics } = await c.env.DB.prepare(
		`SELECT t.id, t.title, t.summary, t.source_count, t.period_type,
		        t.generated_at, t.period_start, t.period_end
		 FROM topics t
		 WHERE t.period_type = ?
		 ORDER BY t.source_count DESC`,
	)
		.bind(period)
		.all();
	return c.json(topics);
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

app.get("/api/topics/:id", async (c) => {
	const topicId = c.req.param("id");
	const topic = await c.env.DB.prepare(
		"SELECT id, title, summary, source_count, period_type, generated_at FROM topics WHERE id = ?",
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
			crawlAllChannels(env.DB)
				.then(async (results) => {
					console.log("Crawl results:", JSON.stringify(results));
					const hasNew = results.some((r) => r.articlesNew > 0);
					if (!hasNew) return;

					const periods = ["daily"];
					const hour = new Date().getUTCHours();
					if (hour === 0) periods.push("weekly");

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
