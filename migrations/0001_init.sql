-- Migration number: 0001 	 2026-03-08T14:38:43.443Z

CREATE TABLE articles (
	id TEXT PRIMARY KEY,
	url TEXT UNIQUE NOT NULL,
	title TEXT NOT NULL,
	description TEXT DEFAULT '',
	published_at TEXT NOT NULL,
	bookmark_count INTEGER DEFAULT 0,
	source TEXT NOT NULL DEFAULT 'hatena',
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE interests (
	id TEXT PRIMARY KEY,
	keyword TEXT NOT NULL UNIQUE,
	description TEXT DEFAULT ''
);

CREATE TABLE crawl_log (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	crawled_at TEXT NOT NULL DEFAULT (datetime('now')),
	source TEXT NOT NULL DEFAULT 'hatena',
	articles_found INTEGER DEFAULT 0,
	articles_new INTEGER DEFAULT 0
);
