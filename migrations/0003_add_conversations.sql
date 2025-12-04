-- AI Conversation history table
CREATE TABLE IF NOT EXISTS conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  segments TEXT NOT NULL, -- JSON array of segment names
  issue TEXT,
  year INTEGER,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  sources TEXT, -- JSON array of source URLs
  model TEXT NOT NULL DEFAULT 'gpt-4o',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_conversations_created ON conversations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_segments ON conversations(segments);
