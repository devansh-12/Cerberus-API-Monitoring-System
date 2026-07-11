#!/usr/bin/env bash
# =============================================================================
# run-phase-b.sh  —  Cerberus Phase B: Resilience Benchmark (fully automated)
#
# What this script does:
#   1. Verifies Docker stack is running
#   2. Cleans + re-seeds the database (fresh slate for Phase B)
#   3. Extracts a real API key from MongoDB
#   4. Restores rate limiter to 100 req/min (RATE_LIMIT_MAX_REQUESTS=100)
#   5. Restarts api-app with the restored rate limit
#   6. Launches high-concurrency replay (200 workers) in the background
#   7. Mid-replay: stops the consumer (events pile up in RabbitMQ)
#   8. Mid-replay: restarts the consumer and measures drain time
#   9. Injects malformed payloads to trigger DLQ routing
#  10. Waits for replay to finish, then collects full metrics
#
# Usage:
#   bash benchmark/run-phase-b.sh
#   bash benchmark/run-phase-b.sh --events 100000   # adjust event count
#   bash benchmark/run-phase-b.sh --crash-delay 30  # seconds before crash
#
# Prerequisites:
#   - Docker running: docker compose up -d
#   - Phase A already run (or fresh seed is fine)
# =============================================================================

set -euo pipefail

# ── Defaults ──────────────────────────────────────────────────────────────────
EVENTS=100000
WORKERS=200
CRASH_DELAY=20       # seconds into replay before stopping consumer
CRASH_DURATION=45    # seconds to keep consumer stopped
TARGET="http://localhost:5000/api/hit"
HEALTH_URL="http://localhost:5000/health"
DRAIN_TIMEOUT=180

# ── Parse CLI args ────────────────────────────────────────────────────────────
for i in "$@"; do
  case $i in
    --events=*)       EVENTS="${i#*=}"       ;;
    --workers=*)      WORKERS="${i#*=}"      ;;
    --crash-delay=*)  CRASH_DELAY="${i#*=}"  ;;
    --crash-dur=*)    CRASH_DURATION="${i#*=}" ;;
    --events)         shift; EVENTS="$1"       ;;
    --workers)        shift; WORKERS="$1"      ;;
    --crash-delay)    shift; CRASH_DELAY="$1"  ;;
    --help|-h)
      echo "Usage: bash benchmark/run-phase-b.sh [options]"
      echo "  --events N        Events to replay (default: 100000)"
      echo "  --workers N       Concurrent workers (default: 200)"
      echo "  --crash-delay N   Seconds before stopping consumer (default: 20)"
      echo "  --crash-dur N     Seconds consumer stays stopped (default: 45)"
      exit 0 ;;
  esac
done

# ── Helpers ───────────────────────────────────────────────────────────────────
BOLD="\033[1m"; GREEN="\033[32m"; YELLOW="\033[33m"; RED="\033[31m"; RESET="\033[0m"
CYAN="\033[36m"; MAGENTA="\033[35m"

step()  { echo -e "\n${BOLD}${CYAN}▶ $*${RESET}"; }
ok()    { echo -e "${GREEN}  ✓ $*${RESET}"; }
warn()  { echo -e "${YELLOW}  ⚠ $*${RESET}"; }
info()  { echo -e "${MAGENTA}  ℹ $*${RESET}"; }
die()   { echo -e "${RED}  ✗ $*${RESET}" >&2; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$SERVER_DIR"

START_TS=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
echo -e "\n${BOLD}╔══════════════════════════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}║     Cerberus Phase B — Resilience Benchmark (Automated)      ║${RESET}"
echo -e "${BOLD}╚══════════════════════════════════════════════════════════════╝${RESET}"
echo -e "  Events        : ${EVENTS}"
echo -e "  Workers       : ${WORKERS} (intentional overload)"
echo -e "  Rate limit    : 100 req/min (will produce 429s — expected)"
echo -e "  Crash delay   : ${CRASH_DELAY}s into replay"
echo -e "  Crash duration: ${CRASH_DURATION}s consumer offline"
echo -e "  Started       : ${START_TS}\n"

# ── Step 1: Verify Docker stack ───────────────────────────────────────────────
step "1/10  Verifying Docker stack..."

if ! docker compose ps --filter "status=running" --quiet | grep -q .; then
  warn "No running containers. Starting stack..."
  docker compose up -d
  sleep 15
fi

HEALTH_CHECK_ATTEMPTS=0
until curl -sf "${HEALTH_URL}" > /dev/null 2>&1; do
  HEALTH_CHECK_ATTEMPTS=$((HEALTH_CHECK_ATTEMPTS + 1))
  if [[ $HEALTH_CHECK_ATTEMPTS -ge 12 ]]; then
    die "api-app health check failed after 60s. Is the stack running? (docker compose up -d)"
  fi
  echo "  Waiting for api-app... (${HEALTH_CHECK_ATTEMPTS}/12)"
  sleep 5
done
ok "Stack is healthy"

# ── Step 2: Clean + seed ──────────────────────────────────────────────────────
step "2/10  Seeding database (clean slate for Phase B)..."
npm run seed:clean --silent 2>&1 | grep -E "✅|❌|API Keys:|Clients:" | sed 's/^/  /'
ok "Database seeded"

# ── Step 3: Extract API key ───────────────────────────────────────────────────
step "3/10  Extracting real API key..."
PROD_KEYS=$(node scripts/get-api-key.js --env production 2>/dev/null | grep -E "^\s+sk_" | awk '{print $1}')
API_KEY=$(echo "$PROD_KEYS" | sed -n '1p')

[[ -z "$API_KEY" ]] && die "Could not extract API key. Did seeding succeed?"
ok "API key: ${API_KEY:0:12}... (truncated)"

# A second, unused production key (belongs to a different client) so the DLQ
# test in step 9 isn't sharing the load-test key's rate limit budget.
DLQ_TEST_API_KEY=$(echo "$PROD_KEYS" | sed -n '2p')
if [[ -z "$DLQ_TEST_API_KEY" ]]; then
  warn "Only one production API key seeded — DLQ test will share the load-test key's rate limit"
  DLQ_TEST_API_KEY="$API_KEY"
else
  ok "DLQ test key: ${DLQ_TEST_API_KEY:0:12}... (truncated, unthrottled)"
fi

# ── Step 4: Restore rate limiter ─────────────────────────────────────────────
step "4/10  Restoring RATE_LIMIT_MAX_REQUESTS=100 (Phase B)..."
if grep -q "^RATE_LIMIT_MAX_REQUESTS=" .env; then
  sed -i "s/^RATE_LIMIT_MAX_REQUESTS=.*/RATE_LIMIT_MAX_REQUESTS=100/" .env
else
  echo "RATE_LIMIT_MAX_REQUESTS=100" >> .env
fi
ok "Rate limiter restored to 100 req/min"

# ── Step 5: Restart api-app ───────────────────────────────────────────────────
step "5/10  Restarting api-app with rate limiter active..."
docker compose up -d --no-deps api-app > /dev/null 2>&1
sleep 5
ATTEMPTS=0
until curl -sf "${HEALTH_URL}" > /dev/null 2>&1; do
  ATTEMPTS=$((ATTEMPTS + 1))
  [[ $ATTEMPTS -ge 10 ]] && die "api-app didn't come back after restart"
  sleep 3
done
ok "api-app restarted with rate limit = 100 req/min"

# ── Step 6: Ensure CSV exists (generate if needed) ────────────────────────────
step "6/10  Checking benchmark CSV..."
if [[ ! -f "benchmark/data/cerberus_events.csv" ]]; then
  warn "CSV not found — generating dataset first..."
  node scripts/generate-dataset.js --count "$EVENTS"
  node scripts/parse-nginx-logs.js --limit "$EVENTS"
fi
ok "CSV ready: benchmark/data/cerberus_events.csv"

# ── Step 7: Launch replay in background + consumer crash test ─────────────────
step "7/10  Starting high-concurrency replay (${WORKERS} workers, rate limiter ON)..."
info "429 responses are expected here — they prove the rate limiter is working."
echo ""

# Start replay in background, redirect output to a temp file
REPLAY_LOG=$(mktemp /tmp/cerberus-replay-b-XXXX.log)

node benchmark/replay-logs.js \
  --api-key "$API_KEY" \
  --target  "$TARGET" \
  --limit   "$EVENTS" \
  --workers "$WORKERS" \
  --mode    resilience \
  > "$REPLAY_LOG" 2>&1 &

REPLAY_PID=$!
ok "Replay started in background (PID: ${REPLAY_PID})"

# ── Step 8: Consumer crash test ───────────────────────────────────────────────
step "8/10  Consumer crash simulation..."

echo "  Waiting ${CRASH_DELAY}s for replay to ramp up before crash..."
sleep "$CRASH_DELAY"

# Check replay is still running
if ! kill -0 "$REPLAY_PID" 2>/dev/null; then
  warn "Replay already finished before crash test. Skipping crash test."
else
  # Record queue depth before crash
  DEPTH_BEFORE=$(docker exec api-monitoring-rabbitmq \
    rabbitmqctl list_queues --vhost api_monitoring name messages 2>/dev/null \
    | awk '/^api_hits\t/ {print $2}' | tr -d '[:space:]')
  DEPTH_BEFORE="${DEPTH_BEFORE:-0}"

  echo -e "  ${RED}🔴 Stopping consumer (simulating crash)... Queue depth: ${DEPTH_BEFORE}${RESET}"
  docker stop api-monitoring-consumer > /dev/null 2>&1
  CRASH_START=$(date +%s)

  echo "  Consumer offline for ${CRASH_DURATION}s — events will accumulate in RabbitMQ..."

  # Show live queue depth while consumer is down
  for ((i=0; i<CRASH_DURATION; i+=5)); do
    sleep 5
    Q=$(docker exec api-monitoring-rabbitmq \
      rabbitmqctl list_queues --vhost api_monitoring name messages 2>/dev/null \
      | awk '/^api_hits\t/ {print $2}' | tr -d '[:space:]')
    printf "\r  Queue accumulating: %-8s messages pending  [%ds elapsed]" "${Q:-?}" "$((i+5))"
  done

  # Snapshot queue depth at peak (before restart)
  DEPTH_PEAK=$(docker exec api-monitoring-rabbitmq \
    rabbitmqctl list_queues --vhost api_monitoring name messages 2>/dev/null \
    | awk '/^api_hits\t/ {print $2}' | tr -d '[:space:]')
  DEPTH_PEAK="${DEPTH_PEAK:-0}"

  echo ""
  echo -e "  ${GREEN}🟢 Restarting consumer... Peak queue depth was: ${DEPTH_PEAK}${RESET}"
  docker start api-monitoring-consumer > /dev/null 2>&1
  CRASH_END=$(date +%s)
  CRASH_ACTUAL=$((CRASH_END - CRASH_START))

  ok "Consumer restarted after ${CRASH_ACTUAL}s offline. Queue depth at restart: ${DEPTH_PEAK}"
fi

# ── Step 9: Inject malformed payloads → DLQ test ─────────────────────────────
step "9/10  Injecting malformed payloads to test DLQ routing..."

# Send 5 malformed payloads (missing required endpoint + method), using the
# dedicated DLQ test key so these aren't 429'd by the concurrent load replay.
DLQ_TEST_FAILURES=0
for i in 1 2 3 4 5; do
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "$TARGET" \
    -H "x-api-key: ${DLQ_TEST_API_KEY}" \
    -H "Content-Type: application/json" \
    -d "[{\"statusCode\":200,\"latencyMs\":50,\"_malformed_test\":${i}}]")
  printf "  Malformed payload %d → HTTP %s\n" "$i" "$HTTP_CODE"
  [[ "$HTTP_CODE" != "202" ]] && DLQ_TEST_FAILURES=$((DLQ_TEST_FAILURES + 1))
done

if [[ $DLQ_TEST_FAILURES -gt 0 ]]; then
  warn "${DLQ_TEST_FAILURES}/5 malformed payloads did not return 202 (rate limited?) — DLQ count may undercount"
else
  ok "All malformed payloads accepted (202) — DLQ routing test is valid"
fi

# ── Wait for background replay to finish ──────────────────────────────────────
echo ""
info "Waiting for background replay to complete..."
wait "$REPLAY_PID" 2>/dev/null || true

# Print replay summary from log
echo ""
echo "  ── Replay Output ──────────────────────────────────────"
grep -A 20 "REPLAY RESULTS" "$REPLAY_LOG" | sed 's/^/  /' || true
rm -f "$REPLAY_LOG"

# ── Wait for queue to drain ───────────────────────────────────────────────────
echo ""
info "Waiting for consumer to drain remaining queue..."
WAIT=0
DRAIN_START=$(date +%s)
while true; do
  Q=$(docker exec api-monitoring-rabbitmq \
    rabbitmqctl list_queues --vhost api_monitoring name messages 2>/dev/null \
    | awk '/^api_hits\t/ {print $2}' | tr -d '[:space:]')
  Q="${Q:-0}"

  if [[ "$Q" -eq 0 ]]; then
    DRAIN_END=$(date +%s)
    DRAIN_TIME=$((DRAIN_END - DRAIN_START))
    ok "Queue fully drained in ${DRAIN_TIME}s after consumer restart"
    break
  fi

  if [[ $WAIT -ge $DRAIN_TIMEOUT ]]; then
    warn "Drain timeout (${DRAIN_TIMEOUT}s). ${Q} messages still pending."
    break
  fi

  printf "\r  Draining: %-8s messages remaining  [${WAIT}s]" "$Q"
  sleep 5
  WAIT=$((WAIT + 5))
done

# ── Step 10: Harvest metrics ──────────────────────────────────────────────────
step "10/10  Collecting Phase B metrics..."
echo ""
bash scripts/harvest-metrics.sh B

# ── Summary ───────────────────────────────────────────────────────────────────
END_TS=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
echo -e "\n${BOLD}${GREEN}════════════════════════════════════════════════════════════════${RESET}"
echo -e "${BOLD}${GREEN}  Phase B Complete!${RESET}"
echo -e "${GREEN}  Report    : ${SERVER_DIR}/results/phase-B-report.txt${RESET}"
echo -e "${GREEN}  Started   : ${START_TS}${RESET}"
echo -e "${GREEN}  Ended     : ${END_TS}${RESET}"
echo -e "${BOLD}${GREEN}════════════════════════════════════════════════════════════════${RESET}"

# Restore rate limit to production default after Phase B
echo ""
info "Restoring RATE_LIMIT_MAX_REQUESTS=100 in .env (production default)..."
sed -i "s/^RATE_LIMIT_MAX_REQUESTS=.*/RATE_LIMIT_MAX_REQUESTS=100/" .env
ok "Rate limiter restored. No further action needed."
echo ""
