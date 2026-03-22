/** @jsxImportSource react */
import { useCallback, useEffect, useState } from "react";
import { ListPageLayout } from "./components/list-layout";
import { articlesPageStyles } from "../styles/articles";
import { timeAgo } from "../lib/dates";

interface Article {
	id: string;
	url: string;
	title: string;
	description: string;
	content_type: string;
	published_at: string | null;
	created_at: string;
	channel_name: string | null;
	channel_type: string | null;
}

type SourceFilter = "all" | "crawler" | "slack" | "x_bookmarks";

const PAGE_SIZE = 50;

function sourceLabel(channelType: string | null): {
	text: string;
	className: string;
} {
	if (channelType === "slack") return { text: "Slack", className: "slack" };
	if (channelType === "x_bookmarks")
		return { text: "X Bookmarks", className: "x-bookmarks" };
	return { text: "Crawler", className: "crawler" };
}

export function ArticlesPage() {
	const [source, setSource] = useState<SourceFilter>("all");
	const [articles, setArticles] = useState<Article[]>([]);
	const [loading, setLoading] = useState(true);
	const [hasMore, setHasMore] = useState(false);

	const fetchArticles = useCallback(
		(offset = 0, append = false) => {
			if (!append) setLoading(true);
			const params = new URLSearchParams({
				limit: String(PAGE_SIZE),
				offset: String(offset),
			});
			if (source !== "all") params.set("source", source);

			fetch(`/api/articles?${params}`)
				.then((r) => r.json() as Promise<Article[]>)
				.then((data) => {
					setArticles((prev) => (append ? [...prev, ...data] : data));
					setHasMore(data.length >= PAGE_SIZE);
				})
				.catch(() => {
					if (!append) setArticles([]);
				})
				.finally(() => setLoading(false));
		},
		[source],
	);

	useEffect(() => {
		fetchArticles();
	}, [fetchArticles]);

	const handleLoadMore = () => {
		fetchArticles(articles.length, true);
	};

	return (
		<ListPageLayout title="Articles" styles={articlesPageStyles}>
			<div className="toolbar">
				<div className="tabs">
					{(
						[
							["all", "全て"],
							["crawler", "Crawler"],
							["slack", "Slack"],
							["x_bookmarks", "X Bookmarks"],
						] as const
					).map(([key, label]) => (
						<button
							key={key}
							type="button"
							className={`tab ${source === key ? "active" : ""}`}
							onClick={() => setSource(key as SourceFilter)}
						>
							{label}
						</button>
					))}
				</div>
			</div>

			{loading && <div className="loading">読み込み中...</div>}

			{!loading && articles.length === 0 && (
				<div className="empty-state">記事がありません</div>
			)}

			{!loading &&
				articles.map((article) => {
					const badge = sourceLabel(article.channel_type);
					return (
						<a
							key={article.id}
							href={article.url}
							target="_blank"
							rel="noopener noreferrer"
							className="article-card"
						>
							<div className="article-title">{article.title}</div>
							<div className="article-meta">
								<span className={`source-badge ${badge.className}`}>
									{badge.text}
								</span>
								{article.channel_name && <span>{article.channel_name}</span>}
								<span>
									{timeAgo(article.published_at ?? article.created_at)}
								</span>
							</div>
						</a>
					);
				})}

			{!loading && hasMore && (
				<button type="button" className="load-more" onClick={handleLoadMore}>
					もっと読み込む
				</button>
			)}
		</ListPageLayout>
	);
}
