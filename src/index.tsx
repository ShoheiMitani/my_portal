import { Hono } from "hono";
import { agentsMiddleware } from "hono-agents";
import { crawlAllChannels } from "./agent/crawl";
import type { Env } from "./agent/types";
import { fetchHatenaBlog, fetchSpeakerDeck } from "./lib/feeds";

export { TrendCollectorAgent } from "./agent/trend-collector";

export const app = new Hono<{ Bindings: Env }>();

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

export default {
	fetch: app.fetch,
	async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
		ctx.waitUntil(
			crawlAllChannels(env.DB).then((results) => {
				console.log("Crawl results:", JSON.stringify(results));
			}),
		);
	},
};
