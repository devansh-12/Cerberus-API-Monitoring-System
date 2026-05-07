import * as http from 'http';
import * as https from 'https';
import { URL } from 'url';

export interface HttpClientOptions {
  timeoutMs?: number;
}

export function sendPostRequest(
  urlStr: string,
  headers: Record<string, string>,
  body: string,
  options?: HttpClientOptions
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const url = new URL(urlStr);
      const isHttps = url.protocol === 'https:';
      const requestFn = isHttps ? https.request : http.request;

      const reqOptions: http.RequestOptions | https.RequestOptions = {
        method: 'POST',
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        headers: {
          ...headers,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
        timeout: options?.timeoutMs ?? 3000,
      };

      const req = requestFn(reqOptions, (res) => {
        // We only care that the request completed, consume response data to free up memory
        res.on('data', () => {});
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
             resolve();
          } else {
             reject(new Error(`HTTP ${res.statusCode}`));
          }
        });
      });

      req.on('error', (err) => {
        reject(err);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timed out'));
      });

      req.write(body);
      req.end();
    } catch (err) {
      reject(err);
    }
  });
}
