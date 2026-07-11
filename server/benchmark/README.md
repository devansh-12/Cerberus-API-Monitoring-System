# Cerberus Load Testing & Benchmarking

A two-phase benchmark suite that exercises the **entire Cerberus ingestion pipeline** end-to-end using statistically realistic API gateway traffic.

```
Generated Nginx Logs
  → parse-nginx-logs.js    (Nginx combined format → Cerberus CSV)
  → replay-logs.js         (concurrent HTTP replay → POST /api/ingest)
  → RabbitMQ               (async queue, vhost: api_monitoring)
  → Processor consumer     (MongoDB + PostgreSQL writes)
  → harvest-metrics.sh     (collect all resume-worthy numbers)
```

---

## Why This Approach

| ❌ Avoid | ✅ Use Instead |
|----------|---------------|
| NASA HTTP logs (1995 static files) | Nginx combined log format (real API gateway format) |
| Random JSON generators | Statistically-realistic distribution (Cloudflare/AWS benchmarks) |
| GitHub event streams | API telemetry logs (direct match for Cerberus's purpose) |

The generated dataset uses **Nginx combined log format** — the exact format emitted by Nginx API gateways, Kong, AWS API Gateway, and Kubernetes Nginx Ingress.  
The `parse-nginx-logs.js` script works on both generated files **and any real Nginx log you have**, zero changes needed.

---

## Quick Start — Fully Automated

Make sure the Docker stack is running first:

```bash
cd server
docker compose up -d
```

Then run the phases back-to-back — **everything is automated** (seed, key extraction, dataset generation, rate limit switching, container restarts, drain waiting, metric collection):

```bash
# Phase A — Throughput benchmark (rate limiter off, 500K events)
bash benchmark/run-phase-a.sh

# Phase B — Resilience benchmark (rate limiter on, consumer crash test)
bash benchmark/run-phase-b.sh
```

Results land in `results/phase-A-report.txt` and `results/phase-B-report.txt`.

### Options

```bash
bash benchmark/run-phase-a.sh --count 100000 --workers 25   # smaller quick run
bash benchmark/run-phase-b.sh --events 50000 --crash-delay 15
```

---

## Phase A — Throughput Benchmark

**Goal:** Measure raw pipeline throughput (rate limiter disabled).

### Step 4 — Disable rate limiter

Edit `server/.env` and change:
```
RATE_LIMIT_MAX_REQUESTS=999999
```

Restart the API app only (no need to rebuild):
```bash
docker compose up -d --no-deps api-app
```

### Step 5 — Smoke test (100K events)

```bash
node benchmark/replay-logs.js \
  --api-key sk_YOUR_KEY_HERE \
  --limit 100000 \
  --workers 10
```

✅ Expect: `Successful (2xx): ~100,000`, `Error rate: <1%`.  
❌ If you see `Successful (2xx): 0` — the API key is wrong. Re-run `node scripts/get-api-key.js`.

### Step 6 — Full replay (500K events)

Open **two terminals** and run both at the same time:

**Terminal 1:**
```bash
node benchmark/replay-logs.js \
  --api-key sk_YOUR_KEY_HERE \
  --limit 500000 \
  --workers 50
```

**Terminal 2 (simultaneously):**
```bash
API_KEY=sk_YOUR_KEY_HERE k6 run benchmark/k6-ingest-benchmark.js
```

### Step 7 — Monitor RabbitMQ live

While the replay is running:
```
http://localhost:15672
Username: admin
Password: rabbit123
```

Navigate to **Queues → api_hits**. Screenshot the Publish rate and Deliver rate at peak — this is your "RabbitMQ throughput" resume metric.

### Step 8 — Collect Phase A metrics

```bash
bash scripts/harvest-metrics.sh A
# → writes results/phase-A-report.txt
```

---

## Phase B — Resilience Benchmark

**Goal:** Stress the rate limiter, DLQ, and consumer crash-recovery path.

### Step 9 — Restore rate limiter + reset DB

Edit `server/.env`:
```
RATE_LIMIT_MAX_REQUESTS=100
```

Then:
```bash
npm run seed:clean
docker compose up -d --no-deps api-app
node scripts/get-api-key.js    # get fresh key after re-seed
```

### Step 10 — High-concurrency overload

```bash
node benchmark/replay-logs.js \
  --api-key sk_YOUR_KEY_HERE \
  --limit 100000 \
  --workers 200 \
  --mode resilience
```

With 200 workers hammering a 100 req/min limit, the server will return many 429s — that's **expected** and is exactly what we're measuring.

### Step 11 — Consumer crash test (mid-replay)

While the replay above is still running, open another terminal:

```bash
# Stop consumer — events will pile up in RabbitMQ queue
docker stop api-monitoring-consumer
sleep 45
# Restart — measure how fast the accumulated queue drains
docker start api-monitoring-consumer
```

Watch the RabbitMQ Management UI: queue depth climbs, then rapidly drains after restart.

### Step 12 — Trigger DLQ routing

Send a malformed payload (missing required `endpoint` + `method` fields):

```bash
curl -s -X POST http://localhost:5000/api/ingest \
  -H "x-api-key: sk_YOUR_KEY_HERE" \
  -H "Content-Type: application/json" \
  -d '[{"statusCode":200,"latencyMs":50}]'
```

### Step 13 — k6 resilience test

```bash
API_KEY=sk_YOUR_KEY_HERE \
INJECT_MALFORMED=true \
  k6 run benchmark/k6-resilience-benchmark.js
```

### Step 14 — Collect Phase B metrics

```bash
bash scripts/harvest-metrics.sh B
# → writes results/phase-B-report.txt
```

---

## File Reference

```
server/
├── scripts/
│   ├── generate-dataset.js          Generate 500K Nginx combined log entries
│   ├── parse-nginx-logs.js          Parse any Nginx log → Cerberus CSV
│   ├── get-api-key.js               Print real API keys from MongoDB after seed
│   └── harvest-metrics.sh           Collect metrics from all systems
├── benchmark/
│   ├── data/                        Generated files (gitignored — up to ~130 MB)
│   │   ├── api_gateway.log
│   │   └── cerberus_events.csv
│   ├── replay-logs.js               Core concurrent replay engine
│   ├── k6-ingest-benchmark.js       Phase A k6 test (throughput, 0→500 VUs)
│   └── k6-resilience-benchmark.js   Phase B k6 test (overload + DLQ)
├── results/                         Auto-generated reports (gitignored)
│   ├── phase-A-report.txt
│   └── phase-B-report.txt
└── tests/load/
    └── k6-load-test.js              Quick health check only (not the real benchmark)
```

---

## CLI Reference

### get-api-key.js

```bash
node scripts/get-api-key.js              # show all active keys + quick copy
node scripts/get-api-key.js --env production  # filter by environment
```

### generate-dataset.js

```bash
node scripts/generate-dataset.js [options]

  --count <n>      Number of log entries (default: 500000)
  --out <path>     Output file path
  --clients <n>    Number of simulated client names (default: 3)
```

### parse-nginx-logs.js

```bash
node scripts/parse-nginx-logs.js [options]

  --input <path>   Input Nginx log file (default: benchmark/data/api_gateway.log)
  --output <path>  Output CSV file
  --limit <n>      Max rows to parse (default: 500000)
```

> **Real Nginx logs:** Drop any `access.log` and pass it via `--input /path/to/access.log`.  
> The parser handles both standard Nginx combined format and the `+$request_time` variant.

### replay-logs.js

```bash
node benchmark/replay-logs.js [options]

  --api-key <key>      Real key from: node scripts/get-api-key.js
  --csv <path>         Input CSV (default: benchmark/data/cerberus_events.csv)
  --target <url>       Ingest endpoint (default: http://localhost:5000/api/ingest)
  --batch-size <n>     Events per POST request (default: 100)
  --workers <n>        Concurrent requests (default: 50)
  --limit <n>          Max events to replay (default: 500000)
  --mode <mode>        throughput | resilience (default: throughput)
```

### k6-ingest-benchmark.js

```bash
API_KEY=sk_xxxx k6 run benchmark/k6-ingest-benchmark.js
# with custom target:
k6 run --env API_KEY=sk_xxxx --env TARGET=http://localhost:5000/api/ingest \
  benchmark/k6-ingest-benchmark.js
```

### k6-resilience-benchmark.js

```bash
API_KEY=sk_xxxx k6 run benchmark/k6-resilience-benchmark.js
# with DLQ injection:
k6 run --env API_KEY=sk_xxxx --env INJECT_MALFORMED=true \
  benchmark/k6-resilience-benchmark.js
```

### harvest-metrics.sh

```bash
bash scripts/harvest-metrics.sh A    # Phase A results
bash scripts/harvest-metrics.sh B    # Phase B results
```

---

## Traffic Distribution

| HTTP Method | Weight |
|-------------|--------|
| GET  | ~54% |
| POST | ~43% |
| PUT  | ~3%  |
| DELETE | ~1% |

| Status Class | Weight | Latency Distribution |
|-------------|--------|---------------------|
| 2xx success | ~75% | Normal(μ=90ms, σ=25ms) |
| 4xx client  | ~21% | Normal(μ=40ms, σ=12ms) |
| 5xx server  | ~4%  | Normal(μ=310ms, σ=90ms) |

---

## Expected Results & Resume Claims

After running both phases, you can claim (numbers will vary by machine):

### Phase A — Throughput

```
• Replayed 500K realistic API gateway log entries (Nginx combined format) through the
  full Cerberus ingestion pipeline on a Dockerized local deployment.
• Sustained 2,500+ events/sec with <40 ms P95 ingestion latency at 50 concurrent workers.
• Reduced network overhead by batching 100 events/request, cutting HTTP calls by ~99%.
• Achieved 90%+ Redis cache hit rate for API key validation under sustained load.
```

### Phase B — Resilience

```
• Simulated consumer failure mid-replay: 100% of in-flight events queued safely in
  RabbitMQ and processed on restart within 45 seconds — zero events dropped.
• 100% of malformed payloads routed to Dead Letter Queue — none silently discarded.
• System returned HTTP 429 for all rate-limited requests with zero unexpected 5xx
  under 200-worker sustained overload.
```

---

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| `Successful (2xx): 0` + `Errors: N` | Placeholder `sk_xxx` used as API key | Run `node scripts/get-api-key.js` and use the real key |
| `401 Unauthorized` | Missing or invalid API key | Run `node scripts/get-api-key.js` |
| `403 Forbidden` | Key inactive or no `canIngest` permission | Run `npm run seed:clean` to re-seed |
| `ECONNREFUSED` | Cerberus stack not running | `docker compose up -d` |
| Duplicate key error on seed | Ran `seed:clean && seed` (runs twice) | Only run `npm run seed:clean` |
| `docker-compose: command not found` | System uses Docker V2 plugin | Use `docker compose` (no hyphen) |
| RabbitMQ shows wrong vhost `/` | Old harvest-metrics.sh | Update to latest — uses `--vhost api_monitoring` |
| Very low throughput | Rate limiter still at 100 | Set `RATE_LIMIT_MAX_REQUESTS=999999`, restart: `docker compose up -d --no-deps api-app` |
| `api_gateway.log not found` | Dataset not generated | `node scripts/generate-dataset.js` |
| `cerberus_events.csv not found` | Log not parsed | `node scripts/parse-nginx-logs.js` |
| MongoDB count stays at ~1500 | Events not reaching processor | `docker compose ps` — check consumer is running |
| DLQ is empty after Phase B | DLQ not configured or different name | Check RabbitMQ UI → `localhost:15672` → Queues tab |
