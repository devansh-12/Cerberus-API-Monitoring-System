#!/usr/bin/env node
/**
 * generate-dataset.js
 *
 * Generates a realistic API gateway log file in Nginx combined log format.
 * The traffic distribution is derived from Cloudflare & AWS API Gateway
 * public benchmarks so the dataset is statistically defensible in an interview.
 *
 * Output format (Nginx combined + $request_time):
 *   <ip> - <user> [<timestamp>] "<method> <path> HTTP/1.1" <status> <bytes> "-" "<ua>" <latency_s>
 *
 * Usage:
 *   node scripts/generate-dataset.js
 *   node scripts/generate-dataset.js --count 500000 --out benchmark/data/api_gateway.log
 *   node scripts/generate-dataset.js --count 100000 --clients 3
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── CLI args ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const cfg = {
  count: 500_000,
  out: path.join(__dirname, '../benchmark/data/api_gateway.log'),
  clients: 3,
};
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--count' && args[i + 1]) { cfg.count = parseInt(args[++i], 10); }
  if (args[i] === '--out'   && args[i + 1]) { cfg.out   = args[++i]; }
  if (args[i] === '--clients' && args[i + 1]) { cfg.clients = parseInt(args[++i], 10); }
  if (args[i] === '--help') {
    console.log(`
Usage: node scripts/generate-dataset.js [options]

Options:
  --count <n>      Number of log entries to generate (default: 500000)
  --out <path>     Output file path (default: benchmark/data/api_gateway.log)
  --clients <n>    Number of simulated client names (default: 3)
  --help           Show this help
`);
    process.exit(0);
  }
}

// ── Traffic Distribution ──────────────────────────────────────────────────────
// Source: Cloudflare Radar & AWS API Gateway public benchmarks

const CLIENT_NAMES = [
  'client-acme', 'client-techstart', 'client-dataflow',
  'client-cloudnine', 'client-nexgen',
].slice(0, cfg.clients);

const ENDPOINTS = [
  // [method, path, weight]
  ['GET',    '/api/users',                  12],
  ['GET',    '/api/users/profile',           8],
  ['POST',   '/api/users/login',             9],
  ['POST',   '/api/users/register',          5],
  ['PUT',    '/api/users/settings',          3],
  ['DELETE', '/api/users/account',           1],
  ['GET',    '/api/orders',                  7],
  ['GET',    '/api/orders/history',          6],
  ['POST',   '/api/orders',                  5],
  ['GET',    '/api/payments',                6],
  ['POST',   '/api/payments/process',        8],
  ['GET',    '/api/analytics/stats',         5],
  ['GET',    '/api/products',               10],
  ['POST',   '/api/notifications/send',      4],
  ['POST',   '/api/auth/refresh',            7],
  ['GET',    '/health',                      4],
];

const STATUS_WEIGHTS = [
  // [code, weight, latency_mu_ms, latency_sigma_ms]
  [200, 55, 90,  25],
  [201, 12, 110, 30],
  [204,  8, 70,  20],
  [400,  7, 38,  10],
  [401,  4, 30,   8],
  [403,  2, 30,   8],
  [404,  5, 42,  12],
  [429,  3, 20,   5],
  [500,  3, 320, 90],
  [502,  1, 290, 80],
];

const USER_AGENTS = [
  'axios/1.6.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  'PostmanRuntime/7.36.0',
  'python-requests/2.31.0',
  'okhttp/4.11.0',
  'Go-http-client/1.1',
  'node-fetch/3.3.2',
];

const IP_POOL = [
  '10.0.0.14', '10.0.0.23', '10.0.0.31',
  '192.168.1.5', '192.168.1.12', '192.168.2.7',
  '172.16.0.4', '172.16.0.9', '172.16.1.3',
];

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build a weighted lookup table for O(1) random selection. */
function buildWeightTable(items) {
  const table = [];
  for (const item of items) {
    const weight = Array.isArray(item) ? item[item.length - 1] : item.weight;
    for (let j = 0; j < weight; j++) table.push(item);
  }
  return table;
}

/** Box-Muller transform — returns a sample from N(mu, sigma). */
function normalSample(mu, sigma) {
  let u, v;
  do { u = Math.random(); } while (u === 0);
  do { v = Math.random(); } while (v === 0);
  const n = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return Math.max(1, Math.round(mu + sigma * n));
}

/** Format Date as Nginx timestamp: 10/Jul/2026:14:32:01 +0000 */
function nginxDate(d) {
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const pad = n => String(n).padStart(2, '0');
  return `${pad(d.getUTCDate())}/${MONTHS[d.getUTCMonth()]}/${d.getUTCFullYear()}:${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} +0000`;
}

// ── Main ──────────────────────────────────────────────────────────────────────

function main() {
  const endpointTable  = buildWeightTable(ENDPOINTS);
  const statusTable    = buildWeightTable(STATUS_WEIGHTS);
  const clientTable    = CLIENT_NAMES;

  // Timestamps spread evenly across last 7 days
  const nowMs   = Date.now();
  const weekMs  = 7 * 24 * 60 * 60 * 1000;
  const startMs = nowMs - weekMs;

  fs.mkdirSync(path.dirname(cfg.out), { recursive: true });
  const fd = fs.openSync(cfg.out, 'w');

  const FLUSH_EVERY = 10_000;
  let buf = '';
  let written = 0;

  console.log(`\n🏗  Generating ${cfg.count.toLocaleString()} API gateway log entries...`);
  const t0 = Date.now();

  for (let i = 0; i < cfg.count; i++) {
    const endpoint   = endpointTable[crypto.randomInt(0, endpointTable.length)];
    const statusRow  = statusTable[crypto.randomInt(0, statusTable.length)];
    const clientName = clientTable[crypto.randomInt(0, clientTable.length)];
    const ip         = IP_POOL[crypto.randomInt(0, IP_POOL.length)];
    const ua         = USER_AGENTS[crypto.randomInt(0, USER_AGENTS.length)];

    const [method, urlPath]                 = endpoint;
    const [statusCode, , latMu, latSigma]   = statusRow;
    const latencyMs  = normalSample(latMu, latSigma);
    const latencySec = (latencyMs / 1000).toFixed(3);
    const bytes      = crypto.randomInt(150, 8000);
    const ts         = new Date(startMs + Math.random() * weekMs);

    // Nginx combined format + $request_time at the end
    buf += `${ip} - ${clientName} [${nginxDate(ts)}] "${method} ${urlPath} HTTP/1.1" ${statusCode} ${bytes} "-" "${ua}" ${latencySec}\n`;

    if ((i + 1) % FLUSH_EVERY === 0 || i === cfg.count - 1) {
      fs.writeSync(fd, buf);
      buf = '';
      written = i + 1;
      const pct  = Math.round((written / cfg.count) * 100);
      const rate = Math.round(written / ((Date.now() - t0) / 1000));
      process.stdout.write(`\r  Progress: ${written.toLocaleString()} / ${cfg.count.toLocaleString()} (${pct}%) — ${rate.toLocaleString()} lines/sec`);
    }
  }

  fs.closeSync(fd);
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  const sizeMb  = (fs.statSync(cfg.out).size / 1024 / 1024).toFixed(1);

  console.log(`\n\n✅ Done in ${elapsed}s`);
  console.log(`   File : ${cfg.out}`);
  console.log(`   Size : ${sizeMb} MB`);
  console.log(`   Lines: ${cfg.count.toLocaleString()}`);
  console.log(`\nNext step:\n  node scripts/parse-nginx-logs.js\n`);
}

main();
