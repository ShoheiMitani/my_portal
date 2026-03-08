import { Hono } from "hono";
import type { FC } from "hono/jsx";
import { parse as parseYaml } from "yaml";
import { ListPageLayout } from "../components/layout";
import { Thumbnail } from "../components/thumbnail";
import { fetchHatenaBlog, fetchSpeakerDeck, formatDate } from "../lib/feeds";
import { worksPageStyles } from "../styles/works";
import type { ArticleYmlEntry, FeedEntry } from "../types";
import articlesYml from "../articles.yml";

const works = new Hono();

const WorkEntryItem: FC<{ entry: FeedEntry }> = ({ entry: e }) => (
	<a class="entry" href={e.link} target="_blank" rel="noopener noreferrer">
		<Thumbnail src={e.thumbnail} classPrefix="entry" />
		<div class="entry-body">
			<div class="entry-meta">
				<span
					class={`entry-source ${e.source === "Blog" ? "source-blog" : e.source === "Slide" ? "source-slide" : "source-article"}`}
				>
					{e.source}
				</span>
				<span class="entry-date">{formatDate(e.date)}</span>
			</div>
			<span class="entry-title">{e.title}</span>
		</div>
	</a>
);

const staticArticles: FeedEntry[] = (
	parseYaml(articlesYml) as ArticleYmlEntry[]
).map((a) => ({
	title: a.title,
	link: a.link,
	date: new Date(a.date),
	source: "Article" as const,
	thumbnail: a.thumbnail,
}));

works.get("/", async (c) => {
	const [blog, slides] = await Promise.all([
		fetchHatenaBlog().catch(() => [] as FeedEntry[]),
		fetchSpeakerDeck().catch(() => [] as FeedEntry[]),
	]);
	const entries = [...blog, ...slides, ...staticArticles];
	entries.sort((a, b) => b.date.getTime() - a.date.getTime());

	return c.html(
		<ListPageLayout
			title="Works - ShoheiMitani"
			pageTitle="Works"
			styles={worksPageStyles}
		>
			{entries.map((e) => (
				<WorkEntryItem entry={e} />
			))}
		</ListPageLayout>,
	);
});

export default works;
