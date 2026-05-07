# @cerberus-monitoring/express

The official Express.js middleware for the Cerberus API Monitoring System.

This package provides a drop-in middleware to automatically track API hits, latencies, status codes, and payloads, sending them to your Cerberus monitoring server via a non-blocking, fire-and-forget background process.

## Features

- **Zero Boilerplate:** Integration takes less than 2 minutes.
- **Non-blocking:** API metrics are queued and sent *after* the client response has finished. It will never add latency to your users.
- **Built-in Resilience:** The SDK natively handles HTTP timeouts. If your Cerberus server is down, the SDK handles the failure silently without crashing your app.
- **Intelligent Batching:** For high-traffic systems, the SDK will automatically batch requests and send them concurrently to avoid starving your app's thread pool.
- **Auto-Discovery:** Automatically infers your `serviceName` from your `package.json` or environment variables to minimize configuration.

## Installation

```bash
npm install @cerberus-monitoring/express
```

## Basic Usage

The easiest way to configure the SDK is via environment variables:

```dotenv
# .env
CERBERUS_URL=https://your-cerberus-host/api/hit
CERBERUS_API_KEY=apim_your_secret_key_here
```

Then add it as a global middleware in your Express application:

```javascript
const express = require('express');
const cerberus = require('@cerberus-monitoring/express').default;

const app = express();

// Add the middleware early in your stack
app.use(cerberus());

app.get('/users', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(3000);
```

## Advanced Configuration

You can also pass options programmatically to the middleware:

```javascript
app.use(cerberus({
  apiKey: 'apim_your_secret_key_here', // If not using CERBERUS_API_KEY
  url: 'https://your-cerberus-host/api/hit', // If not using CERBERUS_URL
  serviceName: 'user-service', // Automatically discovered if omitted

  // High-traffic configuration: queue hits and send them concurrently every 2 seconds
  batching: {
    batchSize: 50,           // Buffer up to 50 hits
    flushIntervalMs: 2000    // Flush every 2000ms
  }
}));
```

### Disabling Batching
Batching is enabled by default (buffers 100 hits or flushes every 1 second). To disable batching and dispatch requests immediately after every hit:

```javascript
app.use(cerberus({
  batching: false
}));
```

## Compatibility
- Requires Node.js 18+ (uses native HTTP modules).
- Compatible with Express 4.x and 5.x.
