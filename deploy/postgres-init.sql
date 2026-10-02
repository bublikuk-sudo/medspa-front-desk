CREATE EXTENSION IF NOT EXISTS vector;
-- WF-1 rate limit: one row per contact, the hits of the last 10 minutes. The node's single INSERT ... ON CONFLICT DO UPDATE
-- serialises concurrent messages of one contact on this row, so the count is exact. Same DDL is run once on a live
-- database (Task 13 fix round 1); IF NOT EXISTS keeps both idempotent.
CREATE TABLE IF NOT EXISTS wf1_rate_limit (contact_id text PRIMARY KEY, hits timestamptz[] NOT NULL, notified_at timestamptz);
