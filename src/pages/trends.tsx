/** @jsxImportSource react */
import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import type { RefObject } from "react";
import { ListPageLayout } from "./components/list-layout";
import { trendsPageStyles } from "../styles/trends";
import { timeAgo } from "../lib/dates";

type Preference = "like" | "dislike";

interface Topic {
	id: string;
	title: string;
	summary: string;
	source_count: number;
	period_type: string;
	generated_at: string;
	preference: Preference | null;
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

/** 好みの登録（like/dislike）または取り消し（null）をAPIに送る。成功したらtrue */
async function requestPreferenceChange(
	topicId: string,
	next: Preference | null,
): Promise<boolean> {
	try {
		const url = `/api/topics/${topicId}/preference`;
		const res =
			next === null
				? await fetch(url, { method: "DELETE" })
				: await fetch(url, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ preference: next }),
					});
		return res.ok;
	} catch {
		return false;
	}
}

/**
 * 好みのトグルを楽観的更新で適用し、API失敗時は元の値に巻き戻す。
 * 状態の持ち方（一覧/詳細）はapplyコールバックに委ねる
 */
async function togglePreference(
	topicId: string,
	current: Preference | null,
	pref: Preference,
	apply: (p: Preference | null) => void,
): Promise<void> {
	const next = current === pref ? null : pref;
	apply(next);
	const ok = await requestPreferenceChange(topicId, next);
	if (!ok) apply(current);
}

function TopicListView({
	period,
	setPeriod,
	onSelect,
	scrollYRef,
}: {
	period: PeriodType;
	setPeriod: (p: PeriodType) => void;
	onSelect: (id: string) => void;
	scrollYRef: RefObject<number>;
}) {
	const [topics, setTopics] = useState<Topic[]>([]);
	const [loading, setLoading] = useState(true);
	const [regenerating, setRegenerating] = useState(false);
	const [genError, setGenError] = useState<string | null>(null);
	// 好み登録リクエストが進行中のトピックID（連打による状態不整合を防ぐ）
	const [pendingPrefIds, setPendingPrefIds] = useState<Set<string>>(
		() => new Set(),
	);

	const fetchTopics = useCallback(() => {
		setLoading(true);
		fetch(`/api/topics?period=${period}`)
			.then((r) => {
				if (!r.ok) throw new Error(`HTTP ${r.status}`);
				return r.json() as Promise<Topic[]>;
			})
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

	// 詳細画面から戻ってきたとき、トピック一覧が描画されたらスクロール位置を復元する
	// (カードは !loading && !regenerating のときだけ描画される)。
	// 保存値は消費時にクリアし、paint前に復元してちらつきを防ぐ
	useLayoutEffect(() => {
		if (loading || regenerating) return;
		const y = scrollYRef.current;
		if (y <= 0) return;
		scrollYRef.current = 0;
		window.scrollTo(0, y);
	}, [loading, regenerating, scrollYRef]);

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

	const handlePreference = useCallback(
		async (topic: Topic, pref: Preference) => {
			setPendingPrefIds((prev) => new Set(prev).add(topic.id));
			try {
				await togglePreference(topic.id, topic.preference, pref, (p) =>
					setTopics((prev) =>
						prev.map((t) => (t.id === topic.id ? { ...t, preference: p } : t)),
					),
				);
			} finally {
				setPendingPrefIds((prev) => {
					const nextSet = new Set(prev);
					nextSet.delete(topic.id);
					return nextSet;
				});
			}
		},
		[],
	);

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
					<div
						key={topic.id}
						className={`topic-card ${topic.preference === "dislike" ? "disliked" : ""}`}
					>
						<button
							type="button"
							className="topic-card-body"
							onClick={() => onSelect(topic.id)}
						>
							<div className="topic-title">{topic.title}</div>
							<div className="topic-summary">{topic.summary}</div>
						</button>
						<div className="topic-meta">
							<span>{topic.source_count}件の記事</span>
							<span>{timeAgo(topic.generated_at)}</span>
							<span className="pref-buttons">
								<button
									type="button"
									className={`pref-button ${topic.preference === "like" ? "active" : ""}`}
									onClick={() => handlePreference(topic, "like")}
									disabled={pendingPrefIds.has(topic.id)}
									aria-label="興味あり"
									aria-pressed={topic.preference === "like"}
								>
									👍
								</button>
								<button
									type="button"
									className={`pref-button ${topic.preference === "dislike" ? "active" : ""}`}
									onClick={() => handlePreference(topic, "dislike")}
									disabled={pendingPrefIds.has(topic.id)}
									aria-label="興味なし"
									aria-pressed={topic.preference === "dislike"}
								>
									👎
								</button>
							</span>
						</div>
					</div>
				))}
		</>
	);
}

function TopicDetailView({ topicId }: { topicId: string }) {
	const [detail, setDetail] = useState<TopicDetail | null>(null);
	const [loading, setLoading] = useState(true);
	const [prefPending, setPrefPending] = useState(false);

	useEffect(() => {
		window.scrollTo(0, 0);
		setLoading(true);
		fetch(`/api/topics/${topicId}`)
			.then((r) => {
				if (!r.ok) throw new Error(`HTTP ${r.status}`);
				return r.json() as Promise<TopicDetail>;
			})
			.then(setDetail)
			.catch(() => setDetail(null))
			.finally(() => setLoading(false));
	}, [topicId]);

	const handlePreference = async (pref: Preference) => {
		if (!detail || prefPending) return;
		setPrefPending(true);
		try {
			await togglePreference(topicId, detail.preference, pref, (p) =>
				setDetail((d) => (d ? { ...d, preference: p } : d)),
			);
		} finally {
			setPrefPending(false);
		}
	};

	if (loading) return <div className="loading">読み込み中...</div>;
	if (!detail)
		return <div className="empty-state">トピックが見つかりません</div>;

	return (
		<>
			<div className="detail-title">{detail.title}</div>
			<div className="detail-summary">{detail.summary}</div>

			<div className="detail-pref">
				<button
					type="button"
					className={`detail-pref-button ${detail.preference === "like" ? "active" : ""}`}
					onClick={() => handlePreference("like")}
					disabled={prefPending}
					aria-pressed={detail.preference === "like"}
				>
					👍 興味あり
				</button>
				<button
					type="button"
					className={`detail-pref-button ${detail.preference === "dislike" ? "active" : ""}`}
					onClick={() => handlePreference("dislike")}
					disabled={prefPending}
					aria-pressed={detail.preference === "dislike"}
				>
					👎 興味なし
				</button>
			</div>

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
	const listScrollYRef = useRef(0);

	const handleSelect = useCallback((id: string) => {
		listScrollYRef.current = window.scrollY;
		setSelectedTopicId(id);
	}, []);

	const handleBack = useCallback(() => setSelectedTopicId(null), []);

	return (
		<ListPageLayout
			title="Trends"
			styles={trendsPageStyles}
			onBack={selectedTopicId ? handleBack : undefined}
		>
			{/* 一覧と詳細はpreferenceを独立に保持しており、詳細で変更した好みは
			    一覧が再マウント時にfetchTopicsし直すことで反映される。
			    一覧を隠すだけの実装（マウント維持）に変える場合は再取得の手当てが必要 */}
			{selectedTopicId ? (
				<TopicDetailView topicId={selectedTopicId} />
			) : (
				<TopicListView
					period={period}
					setPeriod={setPeriod}
					onSelect={handleSelect}
					scrollYRef={listScrollYRef}
				/>
			)}
		</ListPageLayout>
	);
}
