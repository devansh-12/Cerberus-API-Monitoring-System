-- ============================================================
-- Migration v2: Add granular status codes + payload size columns
-- File: server/scripts/migrate-metrics-v2.sql
--
-- Run ONCE after init-postgres.sql and migrate-timescale.sql.
-- Safe to re-run — all ADD COLUMN statements use IF NOT EXISTS.
--
-- How to run (Docker exec — avoids host-level auth issues):
--   docker cp server/scripts/migrate-metrics-v2.sql \
--     api-monitoring-postgres:/tmp/migrate-metrics-v2.sql
--   docker exec -it api-monitoring-postgres \
--     psql -U postgres -d api_monitoring -f /tmp/migrate-metrics-v2.sql
-- ============================================================

-- Step 1 ── Add new metric columns to endpoint_metrics
ALTER TABLE endpoint_metrics
  ADD COLUMN IF NOT EXISTS hits_2xx         INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hits_3xx         INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hits_4xx         INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hits_5xx         INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rate_limit_hits  INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS req_bytes_total  BIGINT  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS res_bytes_total  BIGINT  DEFAULT 0;

-- Step 2 ── Targeted index for high-5xx-rate dashboards
-- Filtered index: only rows where at least one server error occurred.
-- Keeps the index small while making "show me unhealthy endpoints" queries fast.
CREATE INDEX IF NOT EXISTS idx_endpoint_metrics_5xx
  ON endpoint_metrics (client_id, time_bucket)
  WHERE hits_5xx > 0;

-- Step 3 ── Index for rate-limit violation queries
CREATE INDEX IF NOT EXISTS idx_endpoint_metrics_rate_limit
  ON endpoint_metrics (client_id, time_bucket)
  WHERE rate_limit_hits > 0;

-- Verification query (uncomment to inspect after migration):
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_name = 'endpoint_metrics'
-- ORDER BY ordinal_position;
