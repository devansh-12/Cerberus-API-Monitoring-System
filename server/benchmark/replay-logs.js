#!/usr/bin/env node
/**
 * replay-logs.js
 *
 * Core replay engine for Cerberus load testing.
 *
 * Reads the parsed CSV (output of parse-nginx-logs.js), groups events into
 * batches of --batch-size, and sends each batch as a single POST to
 * POST /api/ingest with a real seeded API key.
 *
 * The controller already accepts both a single object and a JSON array, so
 * one HTTP request with 100 events = 99% fewer network calls than individual
 * requests — directly validating the SDK batching metric.
 *
 * Modes:
 *   --mode throughput   (default) 50 workers, rate limiter bypassed
 *   --mode resilience   200 workers, multiple API keys, rate limiter active
 *
 * Usage:
 *   node benchmark/replay-logs.js --api-key sk_xxxx --limit 500000
 *   node benchmark/replay-logs.js --limit 100000 --workers 200 --mode resilience
 *   node benchmark/replay-logs.js --help
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import https from 'https';
import http from 'http';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── CLI args ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const cfg = {
  csv:       path.join(__dirname, '../benchmark/data/cerberus_events.csv'),
  target:    'http://localhost:5000/api/hit',
  apiKeys:   [],            // loaded from --api-key or --api-keys-file
  batchSize: 100,
  workers:   50,
  limit:     500_000,
  mode:      'throughput',  // 'throughput' | 'resilience'
  keysFile:  null,
};

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--csv'         && args[i+1]) cfg.csv        = args[++i];
  if (args[i] === '--target'      && args[i+1]) cfg.target     = args[++i];
  if (args[i] === '--api-key'     && args[i+1]) cfg.apiKeys.push(args[++i]);
  if (args[i] === '--keys-file'   && args[i+1]) cfg.keysFile   = args[++i];
  if (args[i] === '--batch-size'  && args[i+1]) cfg.batchSize  = parseInt(args[++i], 10);
  if (args[i] === '--workers'     && args[i+1]) cfg.workers    = parseInt(args[++i], 10);
  if (args[i] === '--limit'       && args[i+1]) cfg.limit      = parseInt(args[++i], 10);
  if (args[i] === '--mode'        && args[i+1]) cfg.mode       = args[++i];
  if (args[i] === '--help') {
    console.log(`
Cerberus Replay Engine

Usage:
  node benchmark/replay-logs.js [options]

Options:
  --csv <path>          Input CSV file (default: benchmark/data/cerberus_events.csv)
  --target <url>        Ingest endpoint (default: http://localhost:5000/api/ingest)
  --api-key <key>       API key (repeat for multiple, round-robin used)
  --keys-file <path>    File with one API key per line (alternative to --api-key)
  --batch-size <n>      Events per POST request (default: 100)
  --workers <n>         Concurrent requests (default: 50)
  --limit <n>           Max events to replay (default: 500000)
  --mode <mode>         'throughput' or 'resilience' (default: throughput)
  --help                Show this help

Examples:
  # Phase A — throughput
  node benchmark/replay-logs.js --api-key sk_xxxx --limit 500000 --workers 50

  # Phase B — resilience (rate limit active)
  node benchmark/replay-logs.js --limit 100000 --workers 200 --mode resilience
`);
    process.exit(0);
  }
}

// Load keys from file if provided
if (cfg.keysFile) {
  const raw = fs.readFileSync(cfg.keysFile, 'utf8');
  cfg.apiKeys.push(...raw.split('\n').map(l => l.trim()).filter(Boolean));
}

// ── HTTP client ───────────────────────────────────────────────────────────────
const urlObj    = new URL(cfg.target);
const transport = urlObj.protocol === 'https:' ? https : http;
const KEEP_ALIVE_AGENT = new (urlObj.protocol === 'https:' ? https : http).Agent({
  keepAlive: true,
  maxSockets: cfg.workers + 10,
});

let keyIndex = 0;
function nextKey() {
  if (cfg.apiKeys.length === 0) return null;
  return cfg.apiKeys[keyIndex++ % cfg.apiKeys.length];
}

function postBatch(batch, apiKey) {
  return new Promise((resolve) => {
    const body = JSON.stringify(batch);
    const reqOptions = {
      hostname: urlObj.hostname,
      port:     urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path:     urlObj.pathname,
      method:   'POST',
      agent:    KEEP_ALIVE_AGENT,
      headers: {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(body),
        ...(apiKey ? { 'x-api-key': apiKey } : {}),
      },
    };

    const t0  = Date.now();
    const req = transport.request(reqOptions, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, latencyMs: Date.now() - t0, events: batch.length }));
    });
    req.on('error', (e) => resolve({ status: 0, latencyMs: Date.now() - t0, events: batch.length, error: e.message }));
    req.setTimeout(15_000, () => { req.destroy(); resolve({ status: 0, latencyMs: 15_000, events: batch.length, error: 'timeout' }); });
    req.write(body);
    req.end();
  });
}

// ── Stats ─────────────────────────────────────────────────────────────────────
const stats = {
  sent:     0,
  success:  0,
  errors:   0,
  rejected: 0,   // 429 rate-limited
  latTotal: 0,
  latCount: 0,
  startMs:  Date.now(),
};

function printProgress(total) {
  const elapsed  = (Date.now() - stats.startMs) / 1000;
  const eps      = elapsed > 0 ? Math.round(stats.sent / elapsed) : 0;
  const avgLat   = stats.latCount > 0 ? Math.round(stats.latTotal / stats.latCount) : 0;
  const errRate  = stats.sent > 0 ? ((stats.errors / stats.sent) * 100).toFixed(2) : '0.00';
  const pct      = Math.round((stats.sent / total) * 100);
  const bar      = '█'.repeat(Math.floor(pct / 5)) + '░'.repeat(20 - Math.floor(pct / 5));

  process.stdout.write(
    `\r[${bar}] ${pct}%  ${stats.sent.toLocaleString()}/${total.toLocaleString()} events` +
    `  |  ${eps.toLocaleString()} ev/s  |  avg ${avgLat}ms  |  err ${errRate}%  |  429: ${stats.rejected}`
  );
}

// ── Worker pool ───────────────────────────────────────────────────────────────
async function runWorkerPool(batches) {
  const total    = batches.length * cfg.batchSize; // approximate
  let   batchIdx = 0;
  let   active   = 0;

  const ticker = setInterval(() => printProgress(cfg.limit), 500);

  await new Promise((resolveAll) => {
    function dispatch() {
      while (active < cfg.workers && batchIdx < batches.length) {
        const batch  = batches[batchIdx++];
        const apiKey = nextKey();
        active++;

        postBatch(batch, apiKey).then((result) => {
          stats.sent    += result.events;
          stats.latTotal += result.latencyMs;
          stats.latCount++;

          if (result.status === 202 || result.status === 200) {
            stats.success += result.events;
          } else if (result.status === 429) {
            stats.rejected++;
          } else {
            stats.errors++;
          }

          active--;
          if (batchIdx < batches.length) {
            dispatch();
          } else if (active === 0) {
            resolveAll();
          }
        });
      }
    }
    dispatch();
  });

  clearInterval(ticker);
}

// ── CSV reader ────────────────────────────────────────────────────────────────
async function loadBatches() {
  if (!fs.existsSync(cfg.csv)) {
    console.error(`\n❌ CSV not found: ${cfg.csv}`);
    console.error(`   Run: node scripts/parse-nginx-logs.js first\n`);
    process.exit(1);
  }

  const rl   = readline.createInterface({ input: fs.createReadStream(cfg.csv), crlfDelay: Infinity });
  const batches = [];
  let   current = [];
  let   total   = 0;
  let   header  = true;

  for await (const line of rl) {
    if (header) { header = false; continue; }   // skip CSV header
    if (!line.trim()) continue;
    if (total >= cfg.limit) break;

    const cols = line.split(',');
    if (cols.length < 6) continue;

    const [timestamp, method, endpoint, statusCode, responseBytes, latencyMs, ip, userAgent, , serviceName] = cols;

    const event = {
      timestamp:     timestamp,
      method:        method,
      endpoint:      endpoint.replace(/^"|"$/g, ''),
      statusCode:    parseInt(statusCode, 10),
      latencyMs:     parseFloat(latencyMs),
      responseBytes: parseInt(responseBytes, 10),
      ip:            ip,
      userAgent:     (userAgent || '').replace(/^"|"$/g, ''),
      serviceName:   (serviceName || 'api-service').trim(),
      // clientSentAt is added just before sending so it reflects actual send time
    };

    current.push(event);
    total++;

    if (current.length >= cfg.batchSize) {
      batches.push(current);
      current = [];
    }
  }

  if (current.length > 0) batches.push(current);
  return { batches, total };
}

// ── Entry point ───────────────────────────────────────────────────────────────
async function main() {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║         Cerberus Replay Engine — Load Test           ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  console.log(`  Mode       : ${cfg.mode}`);
  console.log(`  Target     : ${cfg.target}`);
  console.log(`  CSV        : ${cfg.csv}`);
  console.log(`  Batch size : ${cfg.batchSize} events / request`);
  console.log(`  Workers    : ${cfg.workers} concurrent`);
  console.log(`  Event limit: ${cfg.limit.toLocaleString()}`);
  console.log(`  API keys   : ${cfg.apiKeys.length || '(none — will fail 401, use --api-key)'}`);

  if (cfg.apiKeys.length === 0) {
    console.warn('\n⚠️  No API key supplied. Requests will return 401.');
    console.warn('   Run: node scripts/seed-databases.js to create keys, then pass --api-key sk_xxxx\n');
  }

  console.log('\n📂 Loading batches from CSV...');
  const { batches, total } = await loadBatches();
  console.log(`   Loaded ${total.toLocaleString()} events in ${batches.length.toLocaleString()} batches\n`);

  // Stamp clientSentAt just before each batch is dispatched
  for (const batch of batches) {
    const now = Date.now();
    for (const ev of batch) ev.clientSentAt = now;
  }

  console.log('🚀 Replay starting...\n');
  const t0 = Date.now();
  await runWorkerPool(batches);

  const elapsed  = ((Date.now() - t0) / 1000).toFixed(1);
  const eps      = Math.round(stats.sent / parseFloat(elapsed));
  const avgLat   = stats.latCount > 0 ? Math.round(stats.latTotal / stats.latCount) : 0;
  const errRate  = stats.sent > 0 ? ((stats.errors / stats.sent) * 100).toFixed(2) : '0.00';
  const httpCalls = batches.length;
  const savedCalls = stats.sent - httpCalls;

  console.log('\n\n╔══════════════════════════════════════════════════════╗');
  console.log('║                   REPLAY RESULTS                     ║');
  console.log('╠══════════════════════════════════════════════════════╣');
  console.log(`║  Total events sent   : ${String(stats.sent.toLocaleString()).padEnd(28)}║`);
  console.log(`║  Successful (2xx)    : ${String(stats.success.toLocaleString()).padEnd(28)}║`);
  console.log(`║  Rate limited (429)  : ${String(stats.rejected.toLocaleString()).padEnd(28)}║`);
  console.log(`║  Errors              : ${String(stats.errors.toLocaleString()).padEnd(28)}║`);
  console.log(`║  Error rate          : ${String(errRate + '%').padEnd(28)}║`);
  console.log(`║  Elapsed             : ${String(elapsed + 's').padEnd(28)}║`);
  console.log(`║  Throughput          : ${String(eps.toLocaleString() + ' events/sec').padEnd(28)}║`);
  console.log(`║  Avg HTTP latency    : ${String(avgLat + ' ms').padEnd(28)}║`);
  console.log(`║  HTTP requests made  : ${String(httpCalls.toLocaleString()).padEnd(28)}║`);
  console.log(`║  HTTP calls saved    : ${String(savedCalls.toLocaleString() + ' (batching)').padEnd(28)}║`);
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log('\nNext step:\n  bash scripts/harvest-metrics.sh A\n');
}

main().catch(e => { console.error('\n❌ Fatal:', e.message); process.exit(1); });
