-- Migration number: 0002  Redesign: articles + channels + collection_runs + collection_items

-- ============================================================
-- Drop old tables
-- ============================================================
DROP TABLE IF EXISTS crawl_log;
DROP TABLE IF EXISTS interests;
DROP TABLE IF EXISTS articles;


-- ============================================================
-- リソース: 記事（URLで同一性が担保される再訪可能なコンテンツ）
-- ============================================================
CREATE TABLE articles (
	id           TEXT PRIMARY KEY,
	url          TEXT UNIQUE NOT NULL,
	title        TEXT NOT NULL,
	description  TEXT NOT NULL DEFAULT '',
	content      TEXT NOT NULL DEFAULT '',
	content_type TEXT NOT NULL,
	published_at TEXT,
	metadata     TEXT NOT NULL DEFAULT '{}',
	created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- リソース: チャネル（収集経路の定義）
-- ============================================================
CREATE TABLE channels (
	id           TEXT PRIMARY KEY,
	slug         TEXT UNIQUE NOT NULL,
	name         TEXT NOT NULL,
	channel_type TEXT NOT NULL,
	config       TEXT NOT NULL DEFAULT '{}',
	created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- イベント: 収集実行
-- ============================================================
CREATE TABLE collection_runs (
	id             TEXT PRIMARY KEY,
	channel_id     TEXT NOT NULL REFERENCES channels(id),
	collected_at   TEXT NOT NULL DEFAULT (datetime('now')),
	articles_found INTEGER NOT NULL DEFAULT 0,
	articles_new   INTEGER NOT NULL DEFAULT 0,
	metadata       TEXT NOT NULL DEFAULT '{}'
);

-- ============================================================
-- 交差エンティティ: 記事 × 収集実行
-- ============================================================
CREATE TABLE collection_items (
	id                TEXT PRIMARY KEY,
	article_id        TEXT NOT NULL REFERENCES articles(id),
	collection_run_id TEXT NOT NULL REFERENCES collection_runs(id),
	UNIQUE(article_id, collection_run_id)
);
