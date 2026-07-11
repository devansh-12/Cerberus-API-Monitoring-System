/**
 * k6-load-test.js — Quick sanity / health check
 *
 * Lightweight baseline test that verifies the stack is reachable
 * before running the full benchmark suite.
 *
 * For real load tests, use:
 *   benchmark/k6-ingest-benchmark.js    (Phase A — throughput)
 *   benchmark/k6-resilience-benchmark.js (Phase B — resilience)
 *
 * Run:
 *   k6 run tests/load/k6-load-test.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 20  },
    { duration: '1m',  target: 10  },
    { duration: '20s', target: 0   },
  ],
  thresholds: {
    http_req_failed:   ['rate<0.01'],
    http_req_duration: ['p(95)<500'],
  },
};

export default function healthCheck() {
  const res = http.get('http://localhost:5000/health');
  check(res, { 'health check 200': r => r.status === 200 });
  sleep(1);
}
