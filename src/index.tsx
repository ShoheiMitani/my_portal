import { Hono } from "hono";
import { agentsMiddleware } from "hono-agents";
import { fetchHatenaBlog, fetchSpeakerDeck } from "./lib/feeds";

export { TrendCollectorAgent } from "./agent/trend-collector";

const app = new Hono();

app.use("*", agentsMiddleware());

app.get("/api/feeds/blog", async (c) => {
	const entries = await fetchHatenaBlog().catch(() => []);
	return c.json(entries);
});

app.get("/api/feeds/slides", async (c) => {
	const entries = await fetchSpeakerDeck().catch(() => []);
	return c.json(entries);
});

export default app;
