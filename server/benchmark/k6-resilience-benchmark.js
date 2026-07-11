/**
 * k6-resilience-benchmark.js  — Phase B: Rate-Limited Resilience
 *
 * Deliberately overloads the Cerberus ingest endpoint at far above the
 * configured rate limit (100 req/min by default) to:
 *   1. Verify the API returns 429 (not 5xx) under overload
 *   2. Confirm no events are silently dropped
 *   3. Populate the Dead Letter Queue with malformed payloads
 *   4. Measure system stability under sustained overload
 *
 * Prerequisites:
 *   1. k6 installed (sudo dnf install k6)
 *   2. RATE_LIMIT_MAX_REQUESTS=100 in server/.env (original value restored)
 *   3. docker-compose up -d --no-deps api-app (restarted with new config)
 *
 * Run:
 *   API_KEY=sk_xxxx k6 run benchmark/k6-resilience-benchmark.js
 *   k6 run --env API_KEY=sk_xxxx --env INJECT_MALFORMED=true benchmark/k6-resilience-benchmark.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Counter, Trend } from 'k6/metrics';

// ── Custom metrics ────────────────────────────────────────────────────────────
const rateLimitedRate   = new Rate('rate_limited_429');
const serverErrorRate   = new Rate('unexpected_5xx');
const malformedRate     = new Rate('malformed_payload');
const successRate       = new Rate('accepted_202');
const ingestLat         = new Trend('ingest_latency_ms', true);
const totalSent         = new Counter('total_events_sent');

// ── Load profile — intentional overload ──────────────────────────────────────
export const options = {
  stages: [
    { duration: '30s', target: 150 },  // ramp to overload quickly
    { duration: '3m',  target: 300 },  // sustained overload
    { duration: '30s', target: 0   },  // drain
  ],
  thresholds: {
    // The system MUST stay stable — 5xx is the failure condition, not 429
    unexpected_5xx:    ['rate<0.02'],  // <2% server errors (429 is expected)
    http_req_duration: ['p(95)<500'],  // even under overload, response time matters
  },
};

const VALID_ENDPOINTS = [
  { method: 'POST', path: '/api/payments/process' },
  { method: 'GET',  path: '/api/users/profile'    },
  { method: 'POST', path: '/api/orders'            },
  { method: 'GET',  path: '/api/analytics/stats'  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
const API_KEY = __ENV.API_KEY || '';
const TARGET  = __ENV.TARGET  || 'http://localhost:5000/api/hit';
const INJECT_MALFORMED = (__ENV.INJECT_MALFORMED || 'false') === 'true';
const HEADERS = { 'Content-Type': 'application/json', 'x-api-key': API_KEY };

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function validPayload() {
  const ep = pick(VALID_ENDPOINTS);
  return [{
    endpoint:    ep.path,
    method:      ep.method,
    statusCode:  [200, 201, 404, 500][Math.floor(Math.random() * 4)],
    latencyMs:   Math.floor(Math.random() * 300) + 20,
    serviceName: 'load-test-service',
    timestamp:   new Date().toISOString(),
  }];
}

function malformedPayload() {
  // Missing required fields — should route to DLQ, NOT silently drop
  return [{ statusCode: 200, latencyMs: 50 }];  // no endpoint, no method
}

// ── VU script ─────────────────────────────────────────────────────────────────
export default function () {
  // 5% of requests use malformed payloads to test DLQ routing
  const useMalformed = INJECT_MALFORMED && Math.random() < 0.05;
  const payload = useMalformed ? malformedPayload() : validPayload();

  const res = http.post(TARGET, JSON.stringify(payload), { headers: HEADERS, timeout: '10s' });

  check(res, {
    'accepted (202)':          r => r.status === 202,
    'rate limited (429)':      r => r.status === 429,
    'no unexpected 5xx':       r => r.status !== 500 && r.status !== 502 && r.status !== 503,
  });

  ingestLat.add(res.timings.duration);
  successRate.add(res.status === 202);
  rateLimitedRate.add(res.status === 429);
  serverErrorRate.add(res.status >= 500);
  malformedRate.add(useMalformed);
  totalSent.add(payload.length);

  sleep(0.01);  // minimal think time to maximize pressure
}

// ── End-of-test summary ───────────────────────────────────────────────────────
export function handleSummary(data) {
  const metrics = data.metrics;

  const total429 = metrics.rate_limited_429?.values?.passes ?? 0;
  const total5xx  = metrics.unexpected_5xx?.values?.passes ?? 0;
  const total202  = metrics.accepted_202?.values?.passes ?? 0;
  const totalReqs = metrics.http_reqs?.values?.count ?? 0;
  const p95       = metrics.http_req_duration?.values?.['p(95)'] ?? 0;

  const summary = `
╔══════════════════════════════════════════════════════════╗
║         Cerberus Phase B — Resilience Results            ║
╠══════════════════════════════════════════════════════════╣
║  Total HTTP requests     : ${String(totalReqs.toLocaleString()).padEnd(30)}║
║  Accepted (202)          : ${String(total202.toLocaleString()).padEnd(30)}║
║  Rate limited (429)      : ${String(total429.toLocaleString()).padEnd(30)}║
║  Unexpected 5xx          : ${String(total5xx.toLocaleString()).padEnd(30)}║
║  P95 response time       : ${String(p95.toFixed(1) + ' ms').padEnd(30)}║
╠══════════════════════════════════════════════════════════╣
║  System stayed stable:   ${total5xx < totalReqs * 0.02 ? '✅ YES' : '❌ NO — check logs'}${' '.repeat(total5xx < totalReqs * 0.02 ? 24 : 19)}║
║  DLQ populated:          Check rabbitmqctl list_queues   ║
╚══════════════════════════════════════════════════════════╝
`;
  console.log(summary);
  return { 'results/phase-b-k6-summary.txt': summary };
}
