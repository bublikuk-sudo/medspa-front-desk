CREATE EXTENSION IF NOT EXISTS vector;
-- WF-1 rate limit: one row per contact, the hits of the last 10 minutes. The node's single INSERT ... ON CONFLICT DO UPDATE
-- serialises concurrent messages of one contact on this row, so the count is exact. Same DDL is run once on a live
-- database (Task 13 fix round 1); IF NOT EXISTS keeps both idempotent.
CREATE TABLE IF NOT EXISTS wf1_rate_limit (contact_id text PRIMARY KEY, hits timestamptz[] NOT NULL, notified_at timestamptz);
-- Task 20 automated dialog tests: send_message's Capture node writes one row per outbound message to a test contact
-- (tg:9000000NNN, wa:+1555000NNNN) instead of sending it. wa_template is non-empty when the WhatsApp template path was
-- chosen. tests/dialog.sh reads the rows, tests/cleanup.sh deletes them. Run once on the live database too (Task 20).
CREATE TABLE IF NOT EXISTS test_outbox (id serial PRIMARY KEY, contact_id text NOT NULL, channel text NOT NULL, template_key text NOT NULL DEFAULT '', wa_template text NOT NULL DEFAULT '', text text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS test_outbox_contact ON test_outbox (contact_id, id);
