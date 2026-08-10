#!/usr/bin/env node
/**
 * SendFlow WhatsApp Daemon (PATCHED 2026-08-10)
 * Persistent WhatsApp Web session + HTTP API for sending messages.
 *
 * Run:  node wacli-daemon.js
 * Port: WACLI_PORT env var or 4555
 * Auth: WACLI_AUTH_DIR env var or ~/.wacli_auth
 *
 * Patches applied:
 *  - Stable Chrome --user-data-dir so WhatsApp Web session cookies survive restart.
 *    (wwebjs LocalAuth 1.34.x only persists creds.json; cookies live in Chrome's
 *    own userDataDir. Without this, every launch starts with a fresh QR.)
 *  - Deep pre-flight before sendMessage: probes document.title and #app root, so
 *    we no longer hit the "t" error when wwebjs races on initial connection.
 *  - QR-too-long watchdog: detects stale LocalAuth and tells Don explicitly.
 *  - /selftest endpoint for remote diagnostics.
 */

const { Client, LocalAuth } = require('whatsapp-web.js');
const http = require('http');
const os = require('os');
const fs = require('fs');
const path = require('path');

const PORT = parseInt(process.env.WACLI_PORT || '4555');
const AUTH_DIR = process.env.WACLI_AUTH_DIR || path.join(os.homedir(), '.wacli_auth');
// Stable Chrome profile dir — must persist between launches so the WhatsApp Web
// session cookies survive. wwebjs LocalAuth (1.34.x) only persists creds.json;
// the rest of the session state lives in Chrome's userDataDir.
const CHROME_USER_DATA_DIR = process.env.WACLI_CHROME_USER_DATA_DIR
  || path.join(AUTH_DIR, 'chrome-profile');

let qrCount = 0;
let firstQrAt = null;
let preflightFailures = 0;

console.log('[wacli-daemon] Starting on port', PORT);
console.log('[wacli-daemon] Node version:', process.version);
console.log('[wacli-daemon] Auth dir:', AUTH_DIR);
console.log('[wacli-daemon] Chrome userDataDir:', CHROME_USER_DATA_DIR);

if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });
if (!fs.existsSync(CHROME_USER_DATA_DIR)) fs.mkdirSync(CHROME_USER_DATA_DIR, { recursive: true });

let clientState = 'DISCONNECTED';
let qrCode = null;
let client = null;
let isRecovering = false;
let recoveryResolve = null;
let recoveryReject = null;

function formatPhone(phone) {
  const clean = (phone || '').replace(/\D/g, '');
  if (clean.startsWith('0')) return '+233' + clean.slice(1);
  if (clean.startsWith('233')) return '+' + clean;
  if (clean.startsWith('+')) return clean;
  return '+233' + clean;
}

function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' });
  res.end(JSON.stringify(data));
}

function waitForReady(c, timeoutMs = 30000) {
  if (c.pupPage && !c.pupPage.isClosed()) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Recovery timeout: client did not emit ready in 30s')), timeoutMs);
    c.once('ready', () => { clearTimeout(timer); resolve(); });
    c.once('auth_failure', (msg) => { clearTimeout(timer); reject(new Error('Auth failure during recovery: ' + msg)); });
    c.once('disconnected', (reason) => { clearTimeout(timer); reject(new Error('Disconnected during recovery: ' + reason)); });
  });
}

async function recoverClient() {
  if (isRecovering) {
    console.log('[wacli-daemon] Recovery already in progress — queuing behind existing recovery');
    return new Promise((resolve, reject) => {
      recoveryResolve = resolve;
      recoveryReject = reject;
    });
  }

  isRecovering = true;
  clientState = 'RECOVERING';
  console.log('[wacli-daemon] Target lost — starting recovery (LocalAuth session reuse, no QR scan)');

  try {
    console.log('[wacli-daemon]   destroying old client...');
    if (client) await client.destroy().catch(() => {});

    console.log('[wacli-daemon]   creating fresh client with existing LocalAuth + chrome profile...');
    client = new Client({
      authStrategy: new LocalAuth({ dataPath: AUTH_DIR }),
      puppeteer: puppeteerOpts,
    });
    attachClientHandlers(client);

    console.log('[wacli-daemon]   calling initialize()...');
    client.initialize();

    await waitForReady(client);
    clientState = 'CONNECTED';
    isRecovering = false;
    console.log('[wacli-daemon]   recovery complete — client ready');
    if (recoveryResolve) { recoveryResolve(); recoveryResolve = null; recoveryReject = null; }
  } catch (err) {
    clientState = 'DISCONNECTED';
    isRecovering = false;
    console.error('[wacli-daemon]   recovery FAILED:', err.message);
    if (recoveryReject) { recoveryReject(err); recoveryResolve = null; recoveryReject = null; }
    throw err;
  }
}

/**
 * Deep pre-flight probe. Returns { ok, reason }.
 * Captures the 't' race before sendMessage is called.
 */
async function probeWhatsAppContext() {
  if (!client || !client.pupPage) return { ok: false, reason: 'no-client-or-pupPage' };
  let closed;
  try { closed = client.pupPage.isClosed(); } catch (e) { return { ok: false, reason: 'isClosed-threw:' + e.message }; }
  if (closed) return { ok: false, reason: 'pupPage-closed' };
  let title = null;
  let appReady = null;
  try {
    title = await client.pupPage.title();
    appReady = await client.pupPage.evaluate(() => document.querySelector('#app') !== null);
  } catch (e) {
    return { ok: false, reason: 'eval-failed:' + (e.message || 'unknown') };
  }
  if (title !== 'WhatsApp Web') return { ok: false, reason: 'wrong-title:' + JSON.stringify(title) };
  if (!appReady) return { ok: false, reason: 'no-#app-root' };
  return { ok: true };
}

async function safeSendMessage(formatted, message) {
  if (clientState !== 'CONNECTED') {
    console.log('[wacli-daemon] pre-flight: not CONNECTED (state=' + clientState + ') — triggering recovery');
    await recoverClient();
  }
  // Deep pre-flight even after CONNECTED — catches the 't' / wwebjs race.
  for (let attempt = 1; attempt <= 2; attempt++) {
    const probe = await probeWhatsAppContext();
    if (probe.ok) break;
    preflightFailures += 1;
    console.warn(`[wacli-daemon] pre-flight FAILED (attempt ${attempt}): ${probe.reason} — triggering recovery`);
    await recoverClient();
    if (attempt >= 2) {
      throw new Error(`WhatsApp context not usable after recovery: ${probe.reason}`);
    }
  }
  console.log('[wacli-daemon] pre-flight OK — context healthy, calling sendMessage');
  return client.sendMessage(formatted, message);
}

const puppeteerOpts = {
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: [
    '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
    '--disable-gpu', '--disable-software-rasterizer', '--disable-web-security',
    // STABLE PROFILE DIR — required for cookies to survive daemon restart.
    `--user-data-dir=${CHROME_USER_DATA_DIR}`,
    // Modern Chrome 151+ flags for headless stability on macOS 24.x.
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--disable-features=Translate,IsolateOrigins,site-per-process',
    '--disable-extensions',
    '--disable-component-extensions-with-background-pages',
  ],
};

try {
  client = new Client({
    authStrategy: new LocalAuth({ dataPath: AUTH_DIR }),
    puppeteer: puppeteerOpts,
  });
} catch (e) {
  console.error('[wacli-daemon] Failed to create client:', e.message);
  process.exit(1);
}

function attachClientHandlers(c) {
  c.on('qr', (qr) => {
    clientState = 'QR_READY';
    qrCode = qr;
    qrCount += 1;
    if (!firstQrAt) firstQrAt = Date.now();
    console.log('[wacli-daemon] QR code ready (#' + qrCount + ')');
    try {
      const QRCode = require('qrcode-terminal');
      QRCode.generate(qr, { small: true }, (ascii) => {
        console.log('\n=== SCAN THIS QR CODE ===\n' + ascii + '\n========================\n');
      });
    } catch (err) {
      console.log('[wacli-daemon] QR data:', qr ? qr.slice(0, 80) : 'none');
    }
    // QR-too-long watchdog. If we stay in QR_READY >25s with no scan,
    // surface that explicitly so Don knows to scan.
    setTimeout(() => {
      if (clientState === 'QR_READY' && firstQrAt && Date.now() - firstQrAt > 25000) {
        console.error('[wacli-daemon] ⚠️  LocalAuth session invalid or first-time setup.');
        console.error('[wacli-daemon] ⚠️  No QR scan detected in 25s. Please scan with phone.');
        console.error('[wacli-daemon] ⚠️  If scan keeps failing, delete ' + AUTH_DIR + ' and rescan.');
      }
    }, 26000);
  });

  c.on('ready', () => {
    clientState = 'CONNECTED';
    qrCode = null;
    console.log('[wacli-daemon] WhatsApp connected!');
    console.log('[wacli-daemon]   qrs-this-session=' + qrCount + ' preflight-failures=' + preflightFailures);
    if (qrCount > 2) {
      console.warn('[wacli-daemon]   WARNING: needed ' + qrCount + ' QR rotations before ready.');
      console.warn('[wacli-daemon]   If this recurs, run: rm -rf ' + CHROME_USER_DATA_DIR + ' && restart.');
    }
    qrCount = 0;
    firstQrAt = null;
  });

  c.on('disconnected', (reason) => {
    clientState = 'DISCONNECTED';
    qrCount = 0;
    firstQrAt = null;
    console.log('[wacli-daemon] Disconnected:', reason);
  });

  c.on('auth_failure', (msg) => {
    clientState = 'AUTH_FAILED';
    console.error('[wacli-daemon] Auth failure:', msg);
  });

  c.on('error', (err) => {
    console.error('[wacli-daemon] Client error:', err.message);
  });
}

async function safeInitialize(c, contextLabel = 'initialize') {
  try {
    await c.initialize();
    console.log('[wacli-daemon] ' + contextLabel + ' completed');
  } catch (err) {
    console.error('[wacli-daemon] ' + contextLabel + ' FAILED:', err.message);
    clientState = 'INIT_FAILED';
    // Schedule a retry — but FIRST wait for the previous Chrome to fully shut down
    // (puppeteer.launch throws 'The browser is already running' if userDataDir is locked)
    setTimeout(async () => {
      try {
        console.log('[wacli-daemon] retry: destroying broken client...');
        await c.destroy().catch(() => {});
        // Wait up to 15s for the puppeteer Chrome process to actually exit
        // and release the userDataDir SingletonLock
        for (let i = 0; i < 30; i++) {
          await new Promise(r => setTimeout(r, 500));
          try {
            // Check if the userDataDir lock is gone
            const lockPath = require('path').join(AUTH_DIR, 'session', 'SingletonLock');
            if (!require('fs').existsSync(lockPath)) break;
          } catch (_) { break; }
        }
        console.log('[wacli-daemon] retry: lock check complete, creating fresh client...');
        const fresh = new Client({
          authStrategy: new LocalAuth({ dataPath: AUTH_DIR }),
          puppeteer: puppeteerOpts,
        });
        attachClientHandlers(fresh);
        client = fresh;
        await safeInitialize(fresh, 'retry-initialize');
      } catch (e2) {
        console.error('[wacli-daemon] retry also failed:', e2.message);
      }
    }, 5_000);
  }
}

attachClientHandlers(client);
console.log('[wacli-daemon] Initializing WhatsApp Web...');
safeInitialize(client, 'initial-initialize');

// --- HTTP Server ---
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-sendflow-key');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const url = new URL(req.url, 'http://' + (req.headers.host || 'localhost:' + PORT));
  const pathname = url.pathname;

  try {
    if ((pathname === '/status' || pathname === '/wacli/status') && req.method === 'GET') {
      sendJSON(res, 200, { connected: clientState === 'CONNECTED', state: clientState });
      return;
    }

    if ((pathname === '/qr' || pathname === '/wacli/qr') && req.method === 'GET') {
      if (clientState !== 'QR_READY' || !qrCode) {
        sendJSON(res, 400, { error: 'No QR code available right now', state: clientState });
        return;
      }
      sendJSON(res, 200, { qr: qrCode, state: clientState });
      return;
    }

    if ((pathname === '/connect' || pathname === '/wacli/connect') && req.method === 'POST') {
      if (clientState === 'CONNECTED') {
        sendJSON(res, 200, { state: clientState, message: 'Already connected' });
        return;
      }
      if (client) client.destroy().catch(() => {});
      setTimeout(() => {
        clientState = 'DISCONNECTED';
        qrCode = null;
        const fresh = new Client({
          authStrategy: new LocalAuth({ dataPath: AUTH_DIR }),
          puppeteer: puppeteerOpts,
        });
        attachClientHandlers(fresh);
        client = fresh;
        safeInitialize(fresh, 'manual-connect');
      }, 1500);
      sendJSON(res, 200, { state: 'RECONNECTING' });
      return;
    }

    if ((pathname === '/selftest' || pathname === '/wacli/selftest') && req.method === 'GET') {
      (async () => {
        const probe = await probeWhatsAppContext();
        let evalResult = null, evalErr = null;
        if (probe.ok) {
          try { evalResult = await client.pupPage.evaluate(() => 1 + 1); }
          catch (e) { evalErr = e.message; }
        }
        let title = null, urlStr = null, closedStr = 'no-pupPage', infoObj = null;
        if (client && client.pupPage) {
          try { title = await client.pupPage.title(); } catch (e) { title = 'threw:' + e.message; }
          try { urlStr = client.pupPage.url(); } catch (e) { urlStr = 'threw:' + e.message; }
          try { closedStr = client.pupPage.isClosed(); } catch (e) { closedStr = 'threw:' + e.message; }
        }
        if (client && client.info) {
          try {
            infoObj = {
              wid: client.info.wid && client.info.wid._serialized,
              platform: client.info.platform,
              pushname: client.info.pushname,
            };
          } catch (e) { infoObj = 'threw:' + e.message; }
        }
        const report = {
          state: clientState,
          qrCount,
          preflightFailures,
          firstQrAt: firstQrAt ? new Date(firstQrAt).toISOString() : null,
          uptimeSec: Math.round(process.uptime()),
          node: process.version,
          authDir: AUTH_DIR,
          chromeUserDataDir: CHROME_USER_DATA_DIR,
          pupPage: client && client.pupPage
            ? { exists: true, closed: closedStr, url: urlStr, title: title }
            : { exists: false },
          contextProbe: probe,
          evalTest: { result: evalResult, error: evalErr },
          clientInfo: infoObj,
          ready: clientState === 'CONNECTED',
          recommendation: probe.ok
            ? 'All healthy. POST /send will work.'
            : ('State=' + clientState + ' probe=' + probe.reason
                + '. If persistent: rm -rf ' + CHROME_USER_DATA_DIR + ' && restart daemon.'),
        };
        sendJSON(res, 200, report);
      })().catch((e) => sendJSON(res, 500, { error: e.message }));
      return;
    }

    if ((pathname === '/send' || pathname === '/wacli/send') && req.method === 'POST') {
      if (clientState !== 'CONNECTED') {
        sendJSON(res, 503, { error: 'WhatsApp not connected', state: clientState });
        return;
      }

      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(body); } catch (e) {
          sendJSON(res, 400, { error: 'Invalid JSON' });
          return;
        }

        const { phone, message } = parsed;
        if (!phone || !message) {
          sendJSON(res, 400, { error: 'phone and message required' });
          return;
        }

        const formatted = formatPhone(phone);
        console.log('[wacli-daemon] Sending to ' + formatted + ' (' + message.length + ' chars)');

        safeSendMessage(formatted, message)
          .then((result) => {
            sendJSON(res, 200, { success: true, messageId: result.id.id });
          })
          .catch((e) => {
            const pupPage = client.pupPage;
            const pageState = pupPage
              ? { url: (() => { try { return pupPage.url(); } catch (_) { return 'unavailable'; } })(),
                  closed: (() => { try { return pupPage.isClosed(); } catch (_) { return 'unavailable'; } })() }
              : null;
            const recoveryState = { isRecovering, clientState };
            const errDetail = {
              message: e.message,
              name: e.name,
              stack: e.stack,
              ...Object.getOwnPropertyNames(e).reduce((acc, prop) => {
                try { acc[prop] = e[prop]; } catch (_) {}
                return acc;
              }, {}),
              pageState,
              recoveryState,
            };
            console.error('[wacli-daemon] Send error:', JSON.stringify(errDetail, null, 2));
            sendJSON(res, 500, errDetail);
          });
      });
      return;
    }

    if (pathname === '/' && req.method === 'GET') {
      sendJSON(res, 200, {
        name: 'SendFlow wacli-daemon', version: '1.0.1', state: clientState,
        uptime: process.uptime(),
        endpoints: ['GET /', 'GET /status', 'GET /qr', 'GET /selftest', 'POST /connect', 'POST /send', '(all routes also accept /wacli/ prefix)'],
      });
      return;
    }

    sendJSON(res, 404, { error: 'Not found' });
  } catch (e) {
    console.error('[wacli-daemon] HTTP error:', e.message);
    sendJSON(res, 500, { error: e.message });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('[wacli-daemon] HTTP listening on http://0.0.0.0:' + PORT);
});

// ─── Process-level crash safety ─────────────────────────────────
// puppeteer-core / whatsapp-web.js can throw async errors that aren't
// caught by our route handlers (e.g. CDP target detached, LifecycleWatcher
// disposed). Without these, the daemon dies and the QR flow stops.
process.on('unhandledRejection', (reason, promise) => {
  console.error('[wacli-daemon] UNHANDLED REJECTION:', reason?.message || reason);
  if (reason?.stack) console.error('  stack:', reason.stack);
  // Don't exit — the daemon should survive transient puppeteer errors
});
process.on('uncaughtException', (err) => {
  console.error('[wacli-daemon] UNCAUGHT EXCEPTION:', err.message);
  if (err.stack) console.error('  stack:', err.stack);
  // Don't exit — log and continue
});

process.on('SIGTERM', async () => {
  console.log('[wacli-daemon] Shutting down...');
  if (client) await client.destroy().catch(() => {});
  server.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[wacli-daemon] Interrupted');
  if (client) await client.destroy().catch(() => {});
  server.close();
  process.exit(0);
});
