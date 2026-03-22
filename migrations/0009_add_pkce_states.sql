CREATE TABLE IF NOT EXISTS pkce_states (
  state TEXT PRIMARY KEY,
  code_verifier TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
