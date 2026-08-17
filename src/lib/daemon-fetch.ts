import https from 'https';
import http from 'http';

/**
 * Shared helper for calling the wacli daemon.
 *
 * Handles:
 * - http/https auto-detection
 * - non-JSON responses (ngrok offline HTML, tunnels, etc.) without crashing JSON.parse
 * - network errors (DNS, connection refused, timeout)
 * - structured logging for debugging
 */
// Default to the LOCAL wacli daemon on this Mac — everything runs on macOS now
// (no VPS). The Vercel deploy overrides this via the WACLI_DAEMON_URL env var
// (the ngrok tunnel URL). The old 'http://84.8.221.131' VPS Baileys fallback is
// gone — that host is dead and was silently causing HTTP 000 dispatch failures.
const DAEMON_URL = process.env.WACLI_DAEMON_URL || 'http://localhost:4555';

export type DaemonResponse = {
  ok: boolean;
  status: number;
  json: () => Promise<any>;
  raw: string;
  contentType: string;
};

export function fetchDaemon(
  path: string,
  options: { method?: string; headers?: http.OutgoingHttpHeaders; body?: string; timeoutMs?: number } = {}
): Promise<DaemonResponse> {
  return new Promise((resolve, reject) => {
    let url: URL;
    try {
      url = new URL(path, DAEMON_URL);
    } catch (e: any) {
      reject(new Error(`Bad daemon URL: ${DAEMON_URL}${path} (${e.message})`));
      return;
    }
    const client = url.protocol === 'https:' ? https : http;
    const timeoutMs = options.timeoutMs ?? 30_000;
    const req = client.request(
      {
        hostname: url.hostname,
        port: url.port || undefined,
        path: url.pathname + url.search,
        method: options.method || 'GET',
        headers: options.headers,
        rejectUnauthorized: false,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          const contentType = String(res.headers['content-type'] || '');
          const isJson = contentType.includes('application/json');
          const ok = !!(res.statusCode && res.statusCode >= 200 && res.statusCode < 300);
          resolve({
            ok,
            status: res.statusCode || 0,
            contentType,
            raw: data,
            // Always return a parsed JSON object if possible, never throw.
            // If the body isn't JSON, wrap the raw text in an error so the
            // caller can decide what to do (instead of crashing JSON.parse
            // with "Unexpected token...").
            json: async () => {
              if (isJson && data.length > 0) {
                try {
                  return JSON.parse(data);
                } catch (e: any) {
                  return { error: `Daemon returned invalid JSON: ${e.message}`, raw: data.slice(0, 500) };
                }
              }
              if (!data) return { ok, status: res.statusCode || 0 };
              // Non-JSON body — could be HTML from a dead tunnel (e.g. ngrok ERR_NGROK_3200),
              // an empty 204, or some plain-text error from the daemon.
              // Return both the raw body and a structured error so callers can see what happened.
              return {
                error: `Daemon returned non-JSON response (${contentType || 'no content-type'})`,
                status: res.statusCode || 0,
                body: data.slice(0, 500),
              };
            },
          });
        });
      }
    );
    req.on('error', (err: any) => {
      reject(new Error(`Daemon request failed (${err.code || 'UNKNOWN'}): ${err.message}`));
    });
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`Daemon request timed out after ${timeoutMs}ms`));
    });
    if (options.body) req.write(options.body);
    req.end();
  });
}

/**
 * Format a Ghana phone number into +233XXXXXXXXX format.
 * Used by all wacli routes and the campaigns send route.
 */
export function formatPhone(phone: string): string {
  const clean = (phone || '').replace(/\D/g, '');
  if (clean.startsWith('0')) return `+233${clean.slice(1)}`;
  if (clean.startsWith('233')) return `+${clean}`;
  return `+233${clean}`;
}

export { DAEMON_URL };