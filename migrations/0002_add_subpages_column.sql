-- Migration: Add subpages JSON payload to market data entries

ALTER TABLE market_data ADD COLUMN subpages TEXT;
