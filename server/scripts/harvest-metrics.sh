#!/usr/bin/env bash
# harvest-metrics.sh
#
# Collects all benchmark metrics from every system after a replay run.
# Run this AFTER replay-logs.js or k6 finishes.
#
# Usage:
#   bash scripts/harvest-metrics.sh A                    # saves results/phase-A-report.txt
#   bash scripts/harvest-metrics.sh B <dlq_baseline> <drain_secs> <accepted_events>
#     dlq_baseline   — DLQ count before this phase ran (to subtract pre-existing messages)
#     drain_secs     — seconds it took for consumer to drain the queue
#     accepted_events — events the server accepted (2xx), excluding 429s

set -euo pipefail

PHASE="${1:-unknown}"
DLQ_BASELINE="${2:-0}"       # pre-existing DLQ messages to subtract
DRAIN_SECS="${3:-}"          # optional: consumer drain time in seconds
ACCEPTED_EVENTS="${4:-}"     # optional: events accepted (2xx) this phase
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
VHOST="api_monitoring"   # RabbitMQ vhost used by Cerberus
mkdir -p results
OUT="results/phase-${PHASE}-report.txt"

log() { echo "$@" | tee -a "$OUT"; }

# ── Header ─────────────────────────────────────────────────────────────────────
echo "" > "$OUT"   # reset file
log "╔══════════════════════════════════════════════════════════════╗"
log "║       CERBERUS BENCHMARK REPORT — Phase ${PHASE}                     ║"
log "╠══════════════════════════════════════════════════════════════╣"
log "║  Collected at: ${TIMESTAMP}                       ║"
log "╚══════════════════════════════════════════════════════════════╝"
log ""

# ── 1. MongoDB total API hits ─────────────────────────────────────────────────
log "━━━ 📦 MongoDB ────────────────────────────────────────────────"

MONGO_COUNT=$(docker exec api-monitoring-mongo \
  mongosh api_monitoring \
  --eval "db.api_hits.countDocuments({})" \
  --quiet 2>/dev/null | tail -1 | tr -d '[:space:]')

log "  Total api_hits documents : ${MONGO_COUNT:-ERROR}"

# E2E latency via updatedAt (written by processor) vs clientSentAt (written by replay script)
# Uses $percentile (MongoDB 7+) for P95; falls back gracefully on older versions.
MONGO_LATENCY=$(docker exec api-monitoring-mongo \
  mongosh api_monitoring --quiet --eval "
    const r = db.api_hits.aggregate([
      { \$match: { clientSentAt: { \$exists: true } } },
      { \$addFields: { e2eMs: { \$subtract: ['\$updatedAt', '\$clientSentAt'] } } },
      { \$group: {
          _id: null,
          avgMs:    { \$avg:  '\$e2eMs' },
          maxMs:    { \$max:  '\$e2eMs' },
          samples:  { \$sum:   1 }
      }}
    ]).toArray();
    if (r.length > 0) {
      print('avg=' + Math.round(r[0].avgMs) + 'ms  max=' + Math.round(r[0].maxMs) + 'ms  samples=' + r[0].samples);
    } else {
      print('no clientSentAt field found — replay did not stamp timestamps on docs');
    }
  " 2>/dev/null | tail -1)

# P50/P95/P99 E2E latency.
# Tries MongoDB 7+ $percentile first; falls back to $bucketAuto (MongoDB 3.4+).
MONGO_PCTILES=$(docker exec api-monitoring-mongo \
  mongosh api_monitoring --quiet --eval "
    // --- attempt 1: MongoDB 7+ native \$percentile ---
    let done = false;
    try {
      const r = db.api_hits.aggregate([
        { \$match: { clientSentAt: { \$exists: true } } },
        { \$addFields: { e2eMs: { \$subtract: ['\$updatedAt', '\$clientSentAt'] } } },
        { \$group: {
            _id: null,
            minMs: { \$min: '\$e2eMs' },
            pcts:  { \$percentile: { input: '\$e2eMs', p: [0.50, 0.95, 0.99], method: 'approximate' } }
        }}
      ]).toArray();
      if (r.length > 0 && r[0].pcts && r[0].pcts.length === 3) {
        const p = r[0].pcts;
        print(Math.round(r[0].minMs) + '|' + Math.round(p[0]) + '|' + Math.round(p[1]) + '|' + Math.round(p[2]));
        done = true;
      }
    } catch(e) {}

    // --- attempt 2: \$bucketAuto fallback (MongoDB 3.4+, any version) ---
    if (!done) {
      try {
        const buckets = db.api_hits.aggregate([
          { \$match: { clientSentAt: { \$exists: true } } },
          { \$addFields: { e2eMs: { \$subtract: ['\$updatedAt', '\$clientSentAt'] } } },
          { \$bucketAuto: { groupBy: '\$e2eMs', buckets: 100 } }
        ], { allowDiskUse: true }).toArray();
        if (buckets.length > 0) {
          const last  = buckets.length - 1;
          const minMs = buckets[0]._id.min;
          const p50   = buckets[Math.min(49, last)]._id.max;
          const p95   = buckets[Math.min(94, last)]._id.max;
          const p99   = buckets[Math.min(98, last)]._id.max;
          print(Math.round(minMs) + '|' + Math.round(p50) + '|' + Math.round(p95) + '|' + Math.round(p99));
        } else { print('n/a|n/a|n/a|n/a'); }
      } catch(e2) { print('n/a|n/a|n/a|n/a'); }
    }
  " 2>/dev/null | tail -1)

MONGO_MIN=$(echo "$MONGO_PCTILES" | cut -d'|' -f1)
MONGO_P50=$(echo "$MONGO_PCTILES" | cut -d'|' -f2)
MONGO_P95=$(echo "$MONGO_PCTILES" | cut -d'|' -f3)
MONGO_P99=$(echo "$MONGO_PCTILES" | cut -d'|' -f4)

log "  E2E pipeline latency (incl. queue wait) : ${MONGO_LATENCY:-not available}"
log "  NOTE: E2E = time from HTTP ingest → consumer writes to Mongo."
log "        Under peak load this includes RabbitMQ backpressure wait time."
log "  E2E min latency           : ${MONGO_MIN:-n/a}ms"
log "  E2E P50 (median) latency  : ${MONGO_P50:-n/a}ms"
log "  E2E P95 latency           : ${MONGO_P95:-n/a}ms"
log "  E2E P99 latency           : ${MONGO_P99:-n/a}ms"
log ""

# ── 2. PostgreSQL aggregated hits ─────────────────────────────────────────────
log "━━━ 📊 PostgreSQL ──────────────────────────────────────────────"

PG_STATS=$(docker exec api-monitoring-postgres \
  psql -U postgres -d api_monitoring -t -A -F'|' \
  -c "SELECT COUNT(*) AS buckets, COALESCE(SUM(total_hits),0) AS total_events FROM endpoint_metrics;" \
  2>/dev/null | tr -d '[:space:]')

if [[ -n "$PG_STATS" ]]; then
  PG_BUCKETS=$(echo "$PG_STATS" | cut -d'|' -f1)
  PG_EVENTS=$(echo  "$PG_STATS" | cut -d'|' -f2)
  log "  Metric buckets : ${PG_BUCKETS}"
  log "  Total hits     : ${PG_EVENTS}"
else
  log "  (could not connect — is postgres container running?)"
fi
log ""

# ── 3. RabbitMQ queue depths (correct vhost) ──────────────────────────────────
log "━━━ 🐰 RabbitMQ ────────────────────────────────────────────────"
log "  Vhost: /${VHOST}"

RMQ_OUTPUT=$(docker exec api-monitoring-rabbitmq \
  rabbitmqctl list_queues \
    --vhost "${VHOST}" \
    name messages_ready messages_unacknowledged \
  2>/dev/null || echo "  (rabbitmq not reachable or vhost '${VHOST}' not found)")

log "$RMQ_OUTPUT"
log ""

# ── 4. Redis cache hit rate ───────────────────────────────────────────────────
log "━━━ ⚡ Redis ────────────────────────────────────────────────────"

# Redis port inside container is always 6379 (even if host maps to 6380)
REDIS_HITS=$(docker exec api-monitoring-redis \
  redis-cli INFO stats 2>/dev/null \
  | grep "keyspace_hits:" | cut -d: -f2 | tr -d '[:space:]\r')

REDIS_MISS=$(docker exec api-monitoring-redis \
  redis-cli INFO stats 2>/dev/null \
  | grep "keyspace_misses:" | cut -d: -f2 | tr -d '[:space:]\r')

REDIS_HITS="${REDIS_HITS:-0}"
REDIS_MISS="${REDIS_MISS:-0}"
REDIS_TOTAL=$((REDIS_HITS + REDIS_MISS))

if [[ $REDIS_TOTAL -gt 0 ]]; then
  REDIS_RATE=$(echo "scale=1; $REDIS_HITS * 100 / $REDIS_TOTAL" | bc 2>/dev/null || echo "N/A")
  log "  Hits     : ${REDIS_HITS}"
  log "  Misses   : ${REDIS_MISS}"
  log "  Hit rate : ${REDIS_RATE}%"
else
  log "  No cache activity yet — did the replay run successfully?"
fi
log ""

# ── 5. DLQ depth (correct vhost) ─────────────────────────────────────────────
log "━━━ 💀 Dead Letter Queue ───────────────────────────────────────"

DLQ_ALL=$(docker exec api-monitoring-rabbitmq \
  rabbitmqctl list_queues \
    --vhost "${VHOST}" \
    name messages 2>/dev/null || echo "")

DLQ_COUNT=$(echo "$DLQ_ALL" | awk '/api_hits\.dlq/ {print $2}' | tr -d '[:space:]')
DLQ_COUNT="${DLQ_COUNT:-0}"

# Subtract pre-existing DLQ messages from a previous phase so the rate
# reflects only messages that failed *during this phase's replay*.
if [[ "$DLQ_BASELINE" =~ ^[0-9]+$ && "$DLQ_COUNT" =~ ^[0-9]+$ ]]; then
  DLQ_THIS_PHASE=$((DLQ_COUNT - DLQ_BASELINE))
  [[ $DLQ_THIS_PHASE -lt 0 ]] && DLQ_THIS_PHASE=0
else
  DLQ_THIS_PHASE="$DLQ_COUNT"
fi

# DLQ failure rate against accepted events (or Mongo count if not provided)
DLQ_DENOMINATOR="${ACCEPTED_EVENTS:-${MONGO_COUNT:-0}}"
if [[ -n "$DLQ_DENOMINATOR" && "$DLQ_DENOMINATOR" -gt 0 && "$DLQ_THIS_PHASE" =~ ^[0-9]+$ ]]; then
  DLQ_RATE=$(echo "scale=4; $DLQ_THIS_PHASE * 100 / $DLQ_DENOMINATOR" | bc 2>/dev/null || echo "N/A")
else
  DLQ_RATE="N/A"
fi

DLQ_OUTPUT=$(echo "$DLQ_ALL" | grep -iE "dlq|dead|failed" || echo "  (no DLQ queues found in vhost ${VHOST})")
log "$DLQ_OUTPUT"
log "  DLQ total (cumulative)    : ${DLQ_COUNT} messages in queue"
log "  DLQ this phase            : ${DLQ_THIS_PHASE} messages (baseline ${DLQ_BASELINE} subtracted)"
log "  DLQ failure rate          : ${DLQ_RATE}%  (of ${DLQ_DENOMINATOR} accepted events)"
log "  All queues in vhost ${VHOST}:"
log "${DLQ_ALL:-  (none)}"
log ""

# ── 6. Docker container resources ────────────────────────────────────────────
log "━━━ 🐳 Docker Resource Snapshot ────────────────────────────────"

docker stats --no-stream \
  --format "  {{.Name}}\tCPU: {{.CPUPerc}}\tMEM: {{.MemUsage}}\tNET I/O: {{.NetIO}}" \
  2>/dev/null | grep -E "api-monitoring" | tee -a "$OUT" || log "  (no api-monitoring containers found)"
log ""

# ── 7. Resume summary ─────────────────────────────────────────────────────────
log "━━━ 📝 Resume-Ready Numbers ────────────────────────────────────"
log ""

# Data consistency check: Mongo vs Postgres event count
if [[ -n "$MONGO_COUNT" && -n "$PG_EVENTS" && "$MONGO_COUNT" == "$PG_EVENTS" ]]; then
  CONSISTENCY="✅ CONSISTENT (Mongo=${MONGO_COUNT} = PG=${PG_EVENTS})"
elif [[ -n "$MONGO_COUNT" && -n "$PG_EVENTS" ]]; then
  CONSISTENCY="⚠️  MISMATCH  (Mongo=${MONGO_COUNT} vs PG=${PG_EVENTS})"
else
  CONSISTENCY="? (data unavailable)"
fi

log "  MongoDB events    : ${MONGO_COUNT:-?}"
log "  PostgreSQL events : ${PG_EVENTS:-?}"
log "  Data consistency  : ${CONSISTENCY}"
log "  Redis hit rate    : ${REDIS_RATE:-? (no activity yet)}%"
log "  DLQ this phase    : ${DLQ_THIS_PHASE:-?} messages  (rate: ${DLQ_RATE:-N/A}%)"
log ""
log "  ── Latency (HTTP ingest layer) ──────────────────────────────"
log "  (See replay output for min/avg/P95/P99 HTTP round-trip latency)"
log ""
log "  ── Latency (full pipeline: ingest → queue → consumer → DB) ─"
log "  NOTE: Under sustained load, this includes RabbitMQ queue-wait"
log "        time. It reflects real async pipeline depth, not a bug."
log "  E2E avg latency   : ${MONGO_LATENCY:-see replay output}"
log "  E2E P50 latency   : ${MONGO_P50:-n/a}ms"
log "  E2E P95 latency   : ${MONGO_P95:-n/a}ms"
log "  E2E P99 latency   : ${MONGO_P99:-n/a}ms"
${DRAIN_SECS:+log "  Consumer drain    : ${DRAIN_SECS}s to drain full queue after replay"}
log ""
log "════════════════════════════════════════════════════════════════"
log "  Report saved → ${OUT}"
log "════════════════════════════════════════════════════════════════"

echo ""
echo "✅ Metrics collected. Report: ${OUT}"
