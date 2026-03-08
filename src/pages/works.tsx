/** @jsxImportSource react */
import { useEffect, useState } from "react";
import { parse as parseYaml } from "yaml";
import { ListPageLayout } from "./components/list-layout";
import { Thumbnail } from "./components/thumbnail";
import { formatDate } from "../lib/feeds";
import { worksPageStyles } from "../styles/works";
import type { ArticleYmlEntry, FeedEntry } from "../types";
import articlesYml from "../articles.yml";

const staticArticles: FeedEntry[] = (
	parseYaml(articlesYml) as ArticleYmlEntry[]
)
	.map((a) => ({
		title: a.title,
		link: a.link,
		date: new Date(a.date),
		source: "Article" as const,
		thumbnail: a.thumbnail,
	}))
	.sort((a, b) => b.date.getTime() - a.date.getTime());

function WorkEntry({ entry: e }: { entry: FeedEntry }) {
	return (
		<a
			className="entry"
			href={e.link}
			target="_blank"
			rel="noopener noreferrer"
		>
			<Thumbnail src={e.thumbnail} classPrefix="entry" />
			<div className="entry-body">
				<div className="entry-meta">
					<span
						className={`entry-source ${e.source === "Blog" ? "source-blog" : e.source === "Slide" ? "source-slide" : "source-article"}`}
					>
						{e.source}
					</span>
					<span className="entry-date">{formatDate(e.date)}</span>
				</div>
				<span className="entry-title">{e.title}</span>
			</div>
		</a>
	);
}

export function WorksPage() {
	const [entries, setEntries] = useState<FeedEntry[]>(staticArticles);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		Promise.all([
			fetch("/api/feeds/blog")
				.then((r) => r.json() as Promise<FeedEntry[]>)
				.then((items) => items.map((i) => ({ ...i, date: new Date(i.date) })))
				.catch(() => [] as FeedEntry[]),
			fetch("/api/feeds/slides")
				.then((r) => r.json() as Promise<FeedEntry[]>)
				.then((items) => items.map((i) => ({ ...i, date: new Date(i.date) })))
				.catch(() => [] as FeedEntry[]),
		]).then(([blog, slides]) => {
			const all = [...blog, ...slides, ...staticArticles];
			all.sort((a, b) => b.date.getTime() - a.date.getTime());
			setEntries(all);
			setLoading(false);
		});
	}, []);

	return (
		<ListPageLayout title="Works" styles={worksPageStyles}>
			{loading && <div className="loading">Loading...</div>}
			{entries.map((e, i) => {
				const year = e.date.getFullYear();
				const prevYear = i > 0 ? entries[i - 1].date.getFullYear() : null;
				return (
					<div key={e.link}>
						{year !== prevYear && <div className="year-separator">{year}</div>}
						<WorkEntry entry={e} />
					</div>
				);
			})}
		</ListPageLayout>
	);
}
