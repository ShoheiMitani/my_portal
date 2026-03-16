/** @jsxImportSource react */
import { useCallback, useEffect, useRef, useState } from "react";
import { ListPageLayout } from "./components/list-layout";
import { trendsPageStyles } from "../styles/trends";
import { timeAgo } from "../lib/dates";

interface Topic {
	id: string;
	title: string;
	summary: string;
	source_count: number;
	period_type: string;
	generated_at: string;
}

interface TopicArticle {
	id: string;
	title: string;
	url: string;
	description: string;
	published_at: string | null;
	channel_name: string | null;
}

interface TopicDetail extends Topic {
	articles: TopicArticle[];
}

type PeriodType = "daily" | "weekly";

function TopicListView({
	period,
	setPeriod,
	onSelect,
}: {
	period: PeriodType;
	setPeriod: (p: PeriodType) => void;
	onSelect: (id: string) => void;
}) {
	const [topics, setTopics] = useState<Topic[]>([]);
	const [loading, setLoading] = useState(true);
	const [regenerating, setRegenerating] = useState(false);
	const [genError, setGenError] = useState<string | null>(null);

	const fetchTopics = useCallback(() => {
		setLoading(true);
		fetch(`/api/topics?period=${period}`)
			.then((r) => r.json() as Promise<Topic[]>)
			.then(setTopics)
			.catch(() => setTopics([]))
			.finally(() => setLoading(false));
	}, [period]);

	const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

	useEffect(() => {
		return () => {
			if (pollingRef.current) clearInterval(pollingRef.current);
		};
	}, []);

	const startPolling = useCallback(() => {
		if (pollingRef.current) clearInterval(pollingRef.current);
		pollingRef.current = setInterval(async () => {
			try {
				const res = await fetch("/api/topics/status");
				const data = (await res.json()) as {
					status: string;
					error?: string;
				};
				if (data.status !== "running") {
					if (pollingRef.current) clearInterval(pollingRef.current);
					pollingRef.current = null;
					setRegenerating(false);
					if (data.status === "error") {
						setGenError(data.error ?? "生成中にエラーが発生しました");
					} else {
						setGenError(null);
					}
					fetchTopics();
				}
			} catch {
				// ignore, retry next interval
			}
		}, 3000);
	}, [fetchTopics]);

	// 初期ロード時: ステータスを確認し、running中ならポーリング開始
	useEffect(() => {
		fetch("/api/topics/status")
			.then((r) => r.json() as Promise<{ status: string }>)
			.then((data) => {
				if (data.status === "running") {
					setRegenerating(true);
					startPolling();
				}
			})
			.catch(() => {})
			.finally(() => fetchTopics());
	}, [fetchTopics, startPolling]);

	const handleRegenerate = async () => {
		setRegenerating(true);
		setGenError(null);
		try {
			await fetch("/api/topics/generate", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ period, force: true }),
			});
			startPolling();
		} catch {
			setRegenerating(false);
		}
	};

	return (
		<>
			<div className="toolbar">
				<div className="tabs">
					<button
						type="button"
						className={`tab ${period === "daily" ? "active" : ""}`}
						onClick={() => setPeriod("daily")}
					>
						24時間
					</button>
					<button
						type="button"
						className={`tab ${period === "weekly" ? "active" : ""}`}
						onClick={() => setPeriod("weekly")}
					>
						1週間
					</button>
				</div>
				<button
					type="button"
					className="regenerate-button"
					onClick={handleRegenerate}
					disabled={loading}
				>
					{regenerating ? "強制再生成" : "再生成"}
				</button>
			</div>

			{genError && <div className="error-message">{genError}</div>}

			{(loading || regenerating) && (
				<div className="loading">
					{regenerating ? "トピックを再生成中..." : "読み込み中..."}
				</div>
			)}

			{!loading && !regenerating && topics.length === 0 && (
				<div className="empty-state">
					<p>トピックがまだありません</p>
					<p>
						「再生成」ボタンを押すか、記事がクロールされると自動生成されます
					</p>
				</div>
			)}

			{!loading &&
				!regenerating &&
				topics.map((topic) => (
					<button
						key={topic.id}
						type="button"
						className="topic-card"
						onClick={() => onSelect(topic.id)}
					>
						<div className="topic-title">{topic.title}</div>
						<div className="topic-summary">{topic.summary}</div>
						<div className="topic-meta">
							<span>{topic.source_count}件の記事</span>
							<span>{timeAgo(topic.generated_at)}</span>
						</div>
					</button>
				))}
		</>
	);
}

function TopicDetailView({
	topicId,
	onBack,
}: {
	topicId: string;
	onBack: () => void;
}) {
	const [detail, setDetail] = useState<TopicDetail | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		setLoading(true);
		fetch(`/api/topics/${topicId}`)
			.then((r) => r.json() as Promise<TopicDetail>)
			.then(setDetail)
			.catch(() => setDetail(null))
			.finally(() => setLoading(false));
	}, [topicId]);

	if (loading) return <div className="loading">読み込み中...</div>;
	if (!detail)
		return <div className="empty-state">トピックが見つかりません</div>;

	return (
		<>
			<button type="button" className="detail-back" onClick={onBack}>
				&larr; トピック一覧に戻る
			</button>
			<div className="detail-title">{detail.title}</div>
			<div className="detail-summary">{detail.summary}</div>

			{detail.articles.map((article) => (
				<a
					key={article.id}
					href={article.url}
					target="_blank"
					rel="noopener noreferrer"
					className="article-card"
				>
					<div className="article-title">{article.title}</div>
					<div className="article-meta">
						{article.channel_name && <span>{article.channel_name}</span>}
						{article.published_at && (
							<span>{timeAgo(article.published_at)}</span>
						)}
					</div>
				</a>
			))}
		</>
	);
}

export function TrendsPage() {
	const [period, setPeriod] = useState<PeriodType>("daily");
	const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);

	const handleBack = useCallback(() => setSelectedTopicId(null), []);

	return (
		<ListPageLayout title="Trends" styles={trendsPageStyles}>
			{selectedTopicId ? (
				<TopicDetailView topicId={selectedTopicId} onBack={handleBack} />
			) : (
				<TopicListView
					period={period}
					setPeriod={setPeriod}
					onSelect={setSelectedTopicId}
				/>
			)}
		</ListPageLayout>
	);
}
