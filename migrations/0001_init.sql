-- Migration: Initial schema for market intelligence data
-- Provides storage for market snapshots sourced from Notion and AI enrichment

CREATE TABLE IF NOT EXISTS market_data (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  segment TEXT NOT NULL,
  issue TEXT,
  year INTEGER NOT NULL,
  market_size REAL,
  growth_rate REAL,
  top10_ratio REAL,
  players TEXT,
  links TEXT,
  summary TEXT,
  notion_page_id TEXT,
  notion_parent_id TEXT,
  subpage_path TEXT,
  last_synced_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_market_data_segment ON market_data(segment);
CREATE INDEX IF NOT EXISTS idx_market_data_issue ON market_data(issue);
CREATE INDEX IF NOT EXISTS idx_market_data_year ON market_data(year);
CREATE UNIQUE INDEX IF NOT EXISTS idx_market_data_segment_issue_year
  ON market_data(segment, issue, year);
