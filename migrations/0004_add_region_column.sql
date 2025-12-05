-- Migration: Add region (領域) column to market_data table
-- Allows filtering and grouping market data by geographical or business regions

ALTER TABLE market_data ADD COLUMN region TEXT;

-- Create index for efficient region-based filtering
CREATE INDEX IF NOT EXISTS idx_market_data_region ON market_data(region);
