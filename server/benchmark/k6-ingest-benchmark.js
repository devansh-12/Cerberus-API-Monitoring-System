/**
 * k6-ingest-benchmark.js  — Phase A: Unlimited Throughput
 *
 * Runs a k6 load test against POST /api/ingest with a realistic payload
 * distribution matching the generated Nginx log dataset.
 *
 * Prerequisites:
 *   1. k6 installed  (sudo dnf install k6)
 *   2. Cerberus stack running  (docker-compose up -d)
 *   3. RATE_LIMIT_MAX_REQUESTS=999999 in server/.env
 *   4. Real API key from seed: export API_KEY=sk_xxxx
 *
 * Run:
 *   API_KEY=sk_xxxx k6 run benchmark/k6-ingest-benchmark.js
 *   k6 run --env API_KEY=sk_xxxx benchmark/k6-ingest-benchmark.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// ── Custom metrics ────────────────────────────────────────────────────────────
const errorRate    = new Rate('ingest_errors');
const ingestLat    = new Trend('ingest_latency_ms', true);
const eventsTotal  = new Counter('events_ingested');

// ── Load profile ──────────────────────────────────────────────────────────────
export const options = {
  stages: [
    { duration: '30s', target: 50  },   // warm-up
    { duration: '2m',  target: 200 },   // sustained load
    { duration: '1m',  target: 500 },   // spike
    { duration: '30s', target: 0   },   // cool-down
  ],
  thresholds: {
    // SLA — test marks FAIL if these are breached
    http_req_failed:          ['rate<0.01'],    // <1% HTTP errors
    http_req_duration:        ['p(95)<300'],    // P95 < 300ms
    ingest_errors:            ['rate<0.01'],
  },
};

// ── Traffic distribution tables ───────────────────────────────────────────────
const ENDPOINTS = [
  { method: 'GET',    path: '/api/users',                 w: 12 },
  { method: 'GET',    path: '/api/users/profile',          w: 8  },
  { method: 'POST',   path: '/api/users/login',            w: 9  },
  { method: 'POST',   path: '/api/users/register',         w: 5  },
  { method: 'PUT',    path: '/api/users/settings',         w: 3  },
  { method: 'GET',    path: '/api/orders',                 w: 7  },
  { method: 'GET',    path: '/api/orders/history',         w: 6  },
  { method: 'POST',   path: '/api/orders',                 w: 5  },
  { method: 'GET',    path: '/api/payments',               w: 6  },
  { method: 'POST',   path: '/api/payments/process',       w: 8  },
  { method: 'GET',    path: '/api/analytics/stats',        w: 5  },
  { method: 'GET',    path: '/api/products',               w: 10 },
  { method: 'POST',   path: '/api/notifications/send',     w: 4  },
  { method: 'POST',   path: '/api/auth/refresh',           w: 7  },
];

const STATUS_CODES = [
  { code: 200, w: 55 }, { code: 201, w: 12 }, { code: 204, w: 8  },
  { code: 400, w: 7  }, { code: 401, w: 4  }, { code: 404, w: 5  },
  { code: 429, w: 3  }, { code: 500, w: 3  }, { code: 502, w: 1  },
];

const SERVICE_MAP = {
  '/api/users':         'user-service',
  '/api/orders':        'order-service',
  '/api/payments':      'payment-service',
  '/api/analytics':     'analytics-service',
  '/api/products':      'product-service',
  '/api/notifications': 'notification-service',
  '/api/auth':          'auth-service',
};

// Build expanded tables for O(1) random selection
function expand(items, getWeight) {
  const t = [];
  for (const item of items)
    for (let i = 0; i < getWeight(item); i++) t.push(item);
  return t;
}
const EP_TABLE  = expand(ENDPOINTS,    e => e.w);
const ST_TABLE  = expand(STATUS_CODES, s => s.w);
const BATCH_SIZE = 50;  // events per POST — validates SDK batching metric

// ── Helpers ───────────────────────────────────────────────────────────────────
function pick(table) { return table[Math.floor(Math.random() * table.length)]; }

function serviceOf(endpoint) {
  for (const prefix of Object.keys(SERVICE_MAP)) {
    if (endpoint.startsWith(prefix)) return SERVICE_MAP[prefix];
  }
  return 'api-service';
}

function makeEvent() {
  const ep      = pick(EP_TABLE);
  const st      = pick(ST_TABLE);
  const latBase = st.code < 400 ? 90 : st.code < 500 ? 40 : 310;
  const latencyMs = Math.max(1, Math.round(latBase + (Math.random() - 0.5) * 60));
  return {
    endpoint:      ep.path,
    method:        ep.method,
    statusCode:    st.code,
    latencyMs:     latencyMs,
    serviceName:   serviceOf(ep.path),
    responseBytes: Math.floor(Math.random() * 7000) + 150,
    timestamp:     new Date().toISOString(),
    clientSentAt:  Date.now(),
  };
}

// ── VU script ─────────────────────────────────────────────────────────────────
const API_KEY = __ENV.API_KEY || '';
const TARGET  = __ENV.TARGET  || 'http://localhost:5000/api/hit';

if (!API_KEY) {
  console.warn('⚠️  API_KEY env var not set. Requests will return 401.');
  console.warn('   Run: k6 run --env API_KEY=sk_xxxx benchmark/k6-ingest-benchmark.js');
}

export default function () {
  const batch = [];
  for (let i = 0; i < BATCH_SIZE; i++) batch.push(makeEvent());

  const res = http.post(
    TARGET,
    JSON.stringify(batch),
    {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key':    API_KEY,
      },
      timeout: '15s',
    }
  );

  const ok = check(res, {
    'status is 202':     r => r.status === 202,
    'no server error':   r => r.status < 500,
  });

  ingestLat.add(res.timings.duration);
  errorRate.add(!ok);
  eventsTotal.add(BATCH_SIZE);

  sleep(0.05);  // 50ms think time — prevents thundering herd
}
