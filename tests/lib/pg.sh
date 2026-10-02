# source tests/lib/pg.sh  (cwd = /opt/medspa; sourced by tests/tool-cases.sh)
# Helpers for the Postgres container. The chat-history table n8n_chat_histories is normally created by the Postgres Chat
# Memory node; the escalate history cases need it earlier, so they create it with the node's own DDL (IF NOT EXISTS),
# seed rows under the test session ids tg:9000000NN, and chat_table_release removes exactly those rows and drops the
# table again only when THIS case created it and nothing else is in it.

pg_sql() { printf '%s\n' "$1" | docker exec -i deploy-postgres-1 sh -c 'psql -q -At -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"'; }   # SQL text -> psql output

chat_table_ensure() {
  chat_table_existed=$(pg_sql "SELECT to_regclass('public.n8n_chat_histories') IS NOT NULL") || return 1
  pg_sql "CREATE TABLE IF NOT EXISTS n8n_chat_histories (id SERIAL PRIMARY KEY, session_id VARCHAR(255) NOT NULL, message JSONB NOT NULL)" > /dev/null
}

chat_seed() { pg_sql "INSERT INTO n8n_chat_histories (session_id, message) VALUES ('$1', '$2'::jsonb)" > /dev/null; }   # session_id, message JSON (no single quotes)

chat_table_release() {
  pg_sql "DELETE FROM n8n_chat_histories WHERE session_id LIKE 'tg:9000000%'" > /dev/null
  if [ "${chat_table_existed:-t}" = f ]; then
    pg_sql 'DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM n8n_chat_histories) THEN DROP TABLE n8n_chat_histories; END IF; END $$' > /dev/null
  fi
}
