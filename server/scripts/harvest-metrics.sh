#!/usr/bin/env bash
# harvest-metrics.sh
#
# Collects all benchmark metrics from every system after a replay run.
# Run this AFTER replay-logs.js or k6 finishes.
#
# Usage:
#   bash scripts/harvest-metrics.sh A      # saves results/phase-A-report.txt
#   bash scripts/harvest-metrics.sh B      # saves results/phase-B-report.txt
#   bash scripts/harvest-metrics.sh        # saves results/phase-unknown-report.txt

set -euo pipefail

PHASE="${1:-unknown}"
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

log "  E2E pipeline latency      : ${MONGO_LATENCY:-not available}"
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

DLQ_OUTPUT=$(echo "$DLQ_ALL" | grep -iE "dlq|dead|failed" || echo "  (no DLQ queues found in vhost ${VHOST})")
log "$DLQ_OUTPUT"
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
log "  MongoDB events    : ${MONGO_COUNT:-?}"
log "  PostgreSQL events : ${PG_EVENTS:-?}"
log "  Redis hit rate    : ${REDIS_RATE:-? (no activity yet)}%"
log "  E2E latency       : ${MONGO_LATENCY:-see replay output}"
log ""
log "════════════════════════════════════════════════════════════════"
log "  Report saved → ${OUT}"
log "════════════════════════════════════════════════════════════════"

echo ""
echo "✅ Metrics collected. Report: ${OUT}"
