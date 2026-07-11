#!/usr/bin/env bash
# =============================================================================
# run-phase-a.sh  —  Cerberus Phase A: Throughput Benchmark (fully automated)
#
# What this script does:
#   1. Verifies Docker stack is running
#   2. Cleans + re-seeds the database
#   3. Extracts a real API key from MongoDB
#   4. Generates 500K realistic Nginx/API Gateway log entries
#   5. Parses them into Cerberus CSV format
#   6. Disables the rate limiter (RATE_LIMIT_MAX_REQUESTS=999999 in .env)
#   7. Restarts the api-app container to pick up the new config
#   8. Runs the full 500K replay against the live stack
#   9. Waits for the RabbitMQ queue to fully drain (all events processed)
#  10. Collects metrics from every system → results/phase-A-report.txt
#
# Usage:
#   bash benchmark/run-phase-a.sh
#   bash benchmark/run-phase-a.sh --count 100000   # smaller run for quick test
#   bash benchmark/run-phase-a.sh --workers 25     # fewer concurrent workers
#
# Prerequisites:
#   - Docker running with: docker compose up -d
#   - Node.js available
# =============================================================================

set -euo pipefail

# ── Defaults (override via CLI) ───────────────────────────────────────────────
COUNT=500000
WORKERS=50
BATCH_SIZE=100
TARGET="http://localhost:5000/api/hit"
HEALTH_URL="http://localhost:5000/health"
DRAIN_TIMEOUT=300   # seconds to wait for queue to drain

# ── Parse CLI args ────────────────────────────────────────────────────────────
for i in "$@"; do
  case $i in
    --count=*)   COUNT="${i#*=}"   ;;
    --workers=*) WORKERS="${i#*=}" ;;
    --count)     shift; COUNT="$1"   ;;
    --workers)   shift; WORKERS="$1" ;;
    --help|-h)
      echo "Usage: bash benchmark/run-phase-a.sh [--count N] [--workers N]"
      echo "  --count N    Events to replay (default: 500000)"
      echo "  --workers N  Concurrent workers (default: 50)"
      exit 0 ;;
  esac
done

# ── Helpers ───────────────────────────────────────────────────────────────────
BOLD="\033[1m"; GREEN="\033[32m"; YELLOW="\033[33m"; RED="\033[31m"; RESET="\033[0m"
CYAN="\033[36m"

step()  { echo -e "\n${BOLD}${CYAN}▶ $*${RESET}"; }
ok()    { echo -e "${GREEN}  ✓ $*${RESET}"; }
warn()  { echo -e "${YELLOW}  ⚠ $*${RESET}"; }
die()   { echo -e "${RED}  ✗ $*${RESET}" >&2; exit 1; }

# Resolve paths relative to project server/ directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$SERVER_DIR"

START_TS=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
echo -e "\n${BOLD}╔══════════════════════════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}║     Cerberus Phase A — Throughput Benchmark (Automated)      ║${RESET}"
echo -e "${BOLD}╚══════════════════════════════════════════════════════════════╝${RESET}"
echo -e "  Events   : ${COUNT}"
echo -e "  Workers  : ${WORKERS} concurrent"
echo -e "  Batch    : ${BATCH_SIZE} events / HTTP request"
echo -e "  Started  : ${START_TS}\n"

# ── Step 1: Verify Docker stack ───────────────────────────────────────────────
step "1/10  Verifying Docker stack..."

if ! docker compose ps --filter "status=running" --quiet | grep -q .; then
  warn "No running containers found. Starting stack..."
  docker compose up -d
  echo "  Waiting 15s for services to be healthy..."
  sleep 15
fi

# Check api-app is reachable
HEALTH_CHECK_ATTEMPTS=0
until curl -sf "${HEALTH_URL}" > /dev/null 2>&1; do
  HEALTH_CHECK_ATTEMPTS=$((HEALTH_CHECK_ATTEMPTS + 1))
  if [[ $HEALTH_CHECK_ATTEMPTS -ge 12 ]]; then
    die "api-app health check failed after 60s. Is the stack running? (docker compose up -d)"
  fi
  echo "  Waiting for api-app to be ready... (${HEALTH_CHECK_ATTEMPTS}/12)"
  sleep 5
done
ok "Stack is healthy (api-app responding)"

# ── Step 2: Clean + seed database ────────────────────────────────────────────
step "2/10  Seeding database (clean run)..."
npm run seed:clean --silent 2>&1 | grep -E "✅|❌|API Keys:|Clients:" | sed 's/^/  /'
ok "Database seeded"

# ── Step 3: Extract API key ───────────────────────────────────────────────────
step "3/10  Extracting real API key..."
API_KEY=$(node scripts/get-api-key.js --env production 2>/dev/null \
  | grep -E "^\s+sk_" | head -1 | awk '{print $1}')

if [[ -z "$API_KEY" ]]; then
  die "Could not extract API key from MongoDB. Did seeding succeed?"
fi
ok "API key: ${API_KEY:0:12}... (truncated)"

# ── Step 4: Generate dataset ──────────────────────────────────────────────────
step "4/10  Generating ${COUNT} Nginx/API Gateway log entries..."
node scripts/generate-dataset.js --count "$COUNT" 2>&1 | grep -E "✅|Lines:|Size:|Progress" | tail -4 | sed 's/^/  /'
ok "Dataset generated → benchmark/data/api_gateway.log"

# ── Step 5: Parse to Cerberus CSV ────────────────────────────────────────────
step "5/10  Parsing Nginx logs → Cerberus CSV..."
node scripts/parse-nginx-logs.js --limit "$COUNT" 2>&1 | grep -E "✅|Rows|CSV" | sed 's/^/  /'
ok "Parsed → benchmark/data/cerberus_events.csv"

# ── Step 6: Disable rate limiter in .env ─────────────────────────────────────
step "6/10  Setting RATE_LIMIT_MAX_REQUESTS=999999 (Phase A)..."
if grep -q "^RATE_LIMIT_MAX_REQUESTS=" .env; then
  sed -i "s/^RATE_LIMIT_MAX_REQUESTS=.*/RATE_LIMIT_MAX_REQUESTS=999999/" .env
else
  echo "RATE_LIMIT_MAX_REQUESTS=999999" >> .env
fi
ok "Rate limiter disabled (.env updated)"

# ── Step 7: Restart api-app to pick up .env change ───────────────────────────
step "7/10  Restarting api-app with new config..."
docker compose up -d --no-deps api-app > /dev/null 2>&1
# Wait for it to come back
sleep 5
ATTEMPTS=0
until curl -sf "${HEALTH_URL}" > /dev/null 2>&1; do
  ATTEMPTS=$((ATTEMPTS + 1))
  [[ $ATTEMPTS -ge 10 ]] && die "api-app didn't come back after restart"
  sleep 3
done
ok "api-app restarted and healthy"

# ── Step 8: Run full replay ───────────────────────────────────────────────────
step "8/10  Replaying ${COUNT} events through the pipeline..."
echo "  (this takes ~60-90s — watch progress below)"
echo ""
node benchmark/replay-logs.js \
  --api-key "$API_KEY" \
  --target  "$TARGET" \
  --limit   "$COUNT" \
  --workers "$WORKERS" \
  --batch-size "$BATCH_SIZE"

# ── Step 9: Wait for RabbitMQ queue to drain ─────────────────────────────────
step "9/10  Waiting for RabbitMQ queue to drain (consumer processing)..."
WAIT=0
while true; do
  QUEUE_DEPTH=$(docker exec api-monitoring-rabbitmq \
    rabbitmqctl list_queues --vhost api_monitoring name messages 2>/dev/null \
    | awk '/^api_hits\t/ {print $2}' | tr -d '[:space:]')

  QUEUE_DEPTH="${QUEUE_DEPTH:-0}"

  if [[ "$QUEUE_DEPTH" -eq 0 ]]; then
    ok "Queue drained — all events processed by consumer"
    break
  fi

  if [[ $WAIT -ge $DRAIN_TIMEOUT ]]; then
    warn "Queue drain timeout (${DRAIN_TIMEOUT}s). ${QUEUE_DEPTH} messages still pending."
    warn "Consumer may be slow — metrics collected anyway. Check logs if needed."
    break
  fi

  printf "\r  Queue depth: %-8s  |  Elapsed: ${WAIT}s / ${DRAIN_TIMEOUT}s  " "$QUEUE_DEPTH"
  sleep 5
  WAIT=$((WAIT + 5))
done

# ── Step 10: Harvest all metrics ─────────────────────────────────────────────
step "10/10  Collecting metrics from all systems..."
echo ""
bash scripts/harvest-metrics.sh A

END_TS=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
echo -e "\n${BOLD}${GREEN}════════════════════════════════════════════════════════════════${RESET}"
echo -e "${BOLD}${GREEN}  Phase A Complete!${RESET}"
echo -e "${GREEN}  Report : ${SERVER_DIR}/results/phase-A-report.txt${RESET}"
echo -e "${GREEN}  Started: ${START_TS}${RESET}"
echo -e "${GREEN}  Ended  : ${END_TS}${RESET}"
echo -e "${BOLD}${GREEN}════════════════════════════════════════════════════════════════${RESET}"
echo ""
echo -e "  ${BOLD}Next:${RESET} Run Phase B → ${CYAN}bash benchmark/run-phase-b.sh${RESET}"
echo ""
