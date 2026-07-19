-- Migration number: 0010  Add topic_preferences table

-- トピックにカテゴリ（ステージ1のアノテーション結果）と
-- demoted（dislike類似による降格フラグ）を持たせる
ALTER TABLE topics ADD COLUMN category TEXT NOT NULL DEFAULT '';
ALTER TABLE topics ADD COLUMN demoted INTEGER NOT NULL DEFAULT 0;

-- ============================================================
-- リソース: トピックへの好み登録（トピック再生成後も残すため
-- topic IDではなく内容のスナップショットを保持する）
-- ============================================================
CREATE TABLE topic_preferences (
	id            TEXT PRIMARY KEY,
	preference    TEXT NOT NULL CHECK (preference IN ('like', 'dislike')),
	topic_title   TEXT NOT NULL UNIQUE,
	topic_summary TEXT NOT NULL,
	category      TEXT NOT NULL DEFAULT '',
	created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
