-- ============================================================
-- Migration: Enable TimescaleDB for endpoint_metrics
-- File: server/scripts/migrate-timescale.sql
--
-- Run ONCE on a live database after init-postgres.sql has already
-- been applied. Safe to re-run — all statements use IF NOT EXISTS
-- or IF EXISTS guards.
--
-- Order of operations:
--   1. Enable the extension
--   2. Drop constraints incompatible with hypertable creation
--   3. Convert the table to a hypertable (monthly chunks)
--   4. Re-add a hypertable-compatible unique index
--   5. Enable column-level compression on cold chunks
--   6. Set automatic data-retention policy (1 year)
-- ============================================================

-- Step 1 ── Enable the TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- Step 2 ── Drop the plain UNIQUE constraint.
-- TimescaleDB requires that any UNIQUE or PRIMARY KEY index includes
-- the partitioning column (time_bucket). Our column already satisfies
-- this, but the constraint must be dropped and recreated as an index.
ALTER TABLE endpoint_metrics
    DROP CONSTRAINT IF EXISTS endpoint_metrics_client_id_service_name_endpoint_method_time__key;

-- Step 3 ── Convert endpoint_metrics to a TimescaleDB hypertable.
-- chunk_time_interval = 1 month: each calendar-month of data is stored
-- in its own physical chunk, keeping per-month queries fast and making
-- compression/retention policies operate cleanly on full months.
SELECT create_hypertable(
    'endpoint_metrics',
    'time_bucket',
    chunk_time_interval => INTERVAL '1 month',
    if_not_exists       => TRUE,
    migrate_data        => TRUE   -- preserve any rows already in the table
);

-- Step 4 ── Re-add the unique constraint as an index.
-- TimescaleDB translates this into a per-chunk unique index automatically.
CREATE UNIQUE INDEX IF NOT EXISTS idx_endpoint_metrics_upsert
    ON endpoint_metrics (client_id, service_name, endpoint, method, time_bucket);

-- Step 5 ── Enable column compression on chunks older than 1 month.
-- timescaledb.compress_segmentby: columns used as segment keys during
-- decompression (high-cardinality query filters → best query performance).
-- timescaledb.compress_orderby: ordering within each compressed segment.
ALTER TABLE endpoint_metrics SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'client_id, service_name',
    timescaledb.compress_orderby   = 'time_bucket DESC'
);

-- Automatically compress chunks that are at least 1 month old
SELECT add_compression_policy(
    'endpoint_metrics',
    compress_after => INTERVAL '1 month',
    if_not_exists  => TRUE
);

-- Step 6 ── Automatic data retention: drop chunks older than 1 year.
-- Operates at the chunk level — no row-by-row deletes, just DROP CHUNK,
-- which is nearly instantaneous regardless of row count.
SELECT add_retention_policy(
    'endpoint_metrics',
    drop_after    => INTERVAL '1 year',
    if_not_exists => TRUE
);

-- Verification: list all hypertable chunks and their time ranges
-- (useful after migration to confirm partitioning is working)
-- SELECT chunk_schema, chunk_name, range_start, range_end
-- FROM timescaledb_information.chunks
-- WHERE hypertable_name = 'endpoint_metrics'
-- ORDER BY range_start;
