-- Migration number: 0004  Add topics and topic_items tables

-- ============================================================
-- リソース: トピック（記事をグルーピングしたトレンド話題）
-- ============================================================
CREATE TABLE topics (
	id           TEXT PRIMARY KEY,
	title        TEXT NOT NULL,
	summary      TEXT NOT NULL,
	source_count INTEGER NOT NULL DEFAULT 0,
	period_type  TEXT NOT NULL,
	generated_at TEXT NOT NULL DEFAULT (datetime('now')),
	period_start TEXT NOT NULL,
	period_end   TEXT NOT NULL,
	metadata     TEXT NOT NULL DEFAULT '{}'
);

-- ============================================================
-- 交差エンティティ: トピック × 記事
-- ============================================================
CREATE TABLE topic_items (
	id           TEXT PRIMARY KEY,
	topic_id     TEXT NOT NULL REFERENCES topics(id),
	article_id   TEXT NOT NULL REFERENCES articles(id),
	relevance_note TEXT NOT NULL DEFAULT '',
	UNIQUE(topic_id, article_id)
);
