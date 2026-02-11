CREATE TABLE IF NOT EXISTS complaints (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  mode TEXT,
  subject TEXT,
  scene TEXT,
  problem TEXT,
  impact TEXT,
  wish TEXT,
  emotion TEXT,
  emotion_value TEXT,
  visibility TEXT,
  categories TEXT,
  severity TEXT,
  summary TEXT,
  detail TEXT,
  contact TEXT,
  attachment_name TEXT,
  attachment_data TEXT,
  sentence TEXT
);

CREATE INDEX IF NOT EXISTS idx_complaints_created_at ON complaints (created_at);
