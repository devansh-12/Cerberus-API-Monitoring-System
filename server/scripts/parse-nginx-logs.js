#!/usr/bin/env node
/**
 * parse-nginx-logs.js
 *
 * Parses any Nginx combined log file (real or generated) into a CSV
 * that replay-logs.js can consume directly.
 *
 * Input format (Nginx combined + $request_time):
 *   <ip> - <user> [<timestamp>] "<method> <path> HTTP/1.1" <status> <bytes> "-" "<ua>" <latency_s>
 *
 * Output CSV columns:
 *   timestamp, method, endpoint, statusCode, responseBytes, latencyMs, ip, userAgent, clientHint, serviceName
 *
 * Usage:
 *   node scripts/parse-nginx-logs.js
 *   node scripts/parse-nginx-logs.js --input benchmark/data/api_gateway.log --limit 500000
 *   node scripts/parse-nginx-logs.js --input /var/log/nginx/access.log --out benchmark/data/cerberus_events.csv
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── CLI args ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const cfg = {
  input:  path.join(__dirname, '../benchmark/data/api_gateway.log'),
  output: path.join(__dirname, '../benchmark/data/cerberus_events.csv'),
  limit:  500_000,
};
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--input'  && args[i + 1]) { cfg.input  = args[++i]; }
  if (args[i] === '--output' && args[i + 1]) { cfg.output = args[++i]; }
  if (args[i] === '--out'    && args[i + 1]) { cfg.output = args[++i]; }
  if (args[i] === '--limit'  && args[i + 1]) { cfg.limit  = parseInt(args[++i], 10); }
  if (args[i] === '--help') {
    console.log(`
Usage: node scripts/parse-nginx-logs.js [options]

Options:
  --input <path>   Input Nginx log file (default: benchmark/data/api_gateway.log)
  --output <path>  Output CSV file (default: benchmark/data/cerberus_events.csv)
  --limit <n>      Max rows to emit (default: 500000)
  --help           Show this help
`);
    process.exit(0);
  }
}

// ── Service name derivation ───────────────────────────────────────────────────
// Maps URL prefix → Cerberus serviceName field
const ENDPOINT_TO_SERVICE = [
  [/^\/api\/users/,         'user-service'],
  [/^\/api\/orders/,        'order-service'],
  [/^\/api\/payments/,      'payment-service'],
  [/^\/api\/analytics/,     'analytics-service'],
  [/^\/api\/products/,      'product-service'],
  [/^\/api\/notifications/,  'notification-service'],
  [/^\/api\/auth/,          'auth-service'],
  [/^\/health/,             'health-service'],
];

function deriveServiceName(endpoint) {
  for (const [pattern, name] of ENDPOINT_TO_SERVICE) {
    if (pattern.test(endpoint)) return name;
  }
  return 'unknown-service';
}

// ── Nginx combined log regex ──────────────────────────────────────────────────
// Handles both standard combined format and the +$request_time variant
const NGINX_RE = /^(\S+)\s+-\s+(\S+)\s+\[([^\]]+)]\s+"(\w+)\s+(\S+)\s+HTTP\/[\d.]+"\s+(\d+)\s+(\d+)\s+"[^"]*"\s+"([^"]*)"\s*([\d.]+)?/;

// Month abbreviation → zero-based index
const MONTH_MAP = { Jan:0, Feb:1, Mar:2, Apr:3, May:4, Jun:5, Jul:6, Aug:7, Sep:8, Oct:9, Nov:10, Dec:11 };

function parseNginxTimestamp(raw) {
  // "10/Jul/2026:14:32:01 +0000"
  const m = raw.match(/^(\d+)\/(\w+)\/(\d+):(\d+):(\d+):(\d+)/);
  if (!m) return new Date().toISOString();
  return new Date(Date.UTC(+m[3], MONTH_MAP[m[2]] ?? 0, +m[1], +m[4], +m[5], +m[6])).toISOString();
}

// ── Latency injection for logs without $request_time ─────────────────────────
function syntheticLatency(statusCode) {
  const mu    = statusCode < 400 ? 90 : statusCode < 500 ? 40 : 310;
  const sigma = statusCode < 400 ? 25 : statusCode < 500 ? 12 : 85;
  let u, v;
  do { u = Math.random(); } while (u === 0);
  do { v = Math.random(); } while (v === 0);
  const n = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return Math.max(1, Math.round(mu + sigma * n));
}

// ── CSV helpers ───────────────────────────────────────────────────────────────
function escCsv(s) {
  if (!s) return '';
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  if (!fs.existsSync(cfg.input)) {
    console.error(`\n❌ Input file not found: ${cfg.input}`);
    console.error(`   Run: node scripts/generate-dataset.js first\n`);
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(cfg.output), { recursive: true });
  const outFd = fs.openSync(cfg.output, 'w');

  // Write CSV header
  fs.writeSync(outFd, 'timestamp,method,endpoint,statusCode,responseBytes,latencyMs,ip,userAgent,clientHint,serviceName\n');

  const rl = readline.createInterface({ input: fs.createReadStream(cfg.input), crlfDelay: Infinity });

  let parsed = 0, skipped = 0;
  const t0 = Date.now();

  console.log(`\n📂 Parsing: ${cfg.input}`);
  console.log(`   Limit  : ${cfg.limit.toLocaleString()} rows\n`);

  for await (const line of rl) {
    if (parsed >= cfg.limit) break;
    if (!line.trim()) continue;

    const m = NGINX_RE.exec(line);
    if (!m) { skipped++; continue; }

    const [, ip, clientHint, rawTs, method, endpoint, rawStatus, rawBytes, ua, rawLatency] = m;

    const statusCode    = parseInt(rawStatus, 10);
    const responseBytes = parseInt(rawBytes, 10);
    const latencyMs     = rawLatency ? Math.round(parseFloat(rawLatency) * 1000) : syntheticLatency(statusCode);
    const timestamp     = parseNginxTimestamp(rawTs);
    const serviceName   = deriveServiceName(endpoint);

    const row = [
      timestamp,
      method,
      escCsv(endpoint),
      statusCode,
      responseBytes,
      latencyMs,
      ip,
      escCsv(ua),
      escCsv(clientHint),
      serviceName,
    ].join(',') + '\n';

    fs.writeSync(outFd, row);
    parsed++;

    if (parsed % 10_000 === 0) {
      const pct  = Math.round((parsed / cfg.limit) * 100);
      const rate = Math.round(parsed / ((Date.now() - t0) / 1000));
      process.stdout.write(`\r  Parsed: ${parsed.toLocaleString()} rows (${pct}%) — ${rate.toLocaleString()} rows/sec  `);
    }
  }

  fs.closeSync(outFd);
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  const sizeMb  = (fs.statSync(cfg.output).size / 1024 / 1024).toFixed(1);

  console.log(`\n\n✅ Parsing complete in ${elapsed}s`);
  console.log(`   Rows parsed  : ${parsed.toLocaleString()}`);
  console.log(`   Rows skipped : ${skipped.toLocaleString()}`);
  console.log(`   Output       : ${cfg.output}`);
  console.log(`   CSV size     : ${sizeMb} MB`);
  console.log(`\nNext step:\n  node benchmark/replay-logs.js --limit 50000 --workers 10\n`);
}

main().catch(e => { console.error(e); process.exit(1); });
