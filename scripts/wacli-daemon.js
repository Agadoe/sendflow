#!/usr/bin/env node
/**
 * SendFlow WhatsApp Daemon
 * Persistent WhatsApp Web session + HTTP API for sending messages.
 *
 * Run:  node wacli-daemon.js
 * Port: WACLI_PORT env var or 4555
 * Auth: WACLI_AUTH_DIR env var or ~/.wacli_auth
 */

const { Client, LocalAuth } = require('whatsapp-web.js');
const http = require('http');
const os = require('os');
const fs = require('fs');
const path = require('path');

const PORT = parseInt(process.env.WACLI_PORT || '4555');
const AUTH_DIR = process.env.WACLI_AUTH_DIR || path.join(os.homedir(), '.wacli_auth');

console.log('[wacli-daemon] Starting on port', PORT);
console.log('[wacli-daemon] Node version:', process.version);

if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });

let clientState = 'DISCONNECTED';
let qrCode = null;
let client = null;

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

const puppeteerOpts = {
  headless: true,
  executablePath: '/home/ubuntu/.cache/ms-playwright/chromium-1223/chrome-linux/chrome',
  args: [
    '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
    '--disable-gpu', '--disable-software-rasterizer', '--disable-web-security',
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

client.on('qr', (qr) => {
  clientState = 'QR_READY';
  qrCode = qr;
  console.log('[wacli-daemon] QR code ready');
  try {
    const QRCode = require('qrcode-terminal');
    QRCode.generate(qr, { small: true }, (ascii) => {
      console.log('\n=== SCAN THIS QR CODE ===\n' + ascii + '\n========================\n');
    });
  } catch (err) {
    console.log('[wacli-daemon] QR data:', qr ? qr.slice(0, 80) : 'none');
  }
});

client.on('ready', () => {
  clientState = 'CONNECTED';
  qrCode = null;
  console.log('[wacli-daemon] WhatsApp connected!');
});

client.on('disconnected', (reason) => {
  clientState = 'DISCONNECTED';
  console.log('[wacli-daemon] Disconnected:', reason);
});

client.on('auth_failure', (msg) => {
  clientState = 'AUTH_FAILED';
  console.error('[wacli-daemon] Auth failure:', msg);
});

client.on('error', (err) => {
  console.error('[wacli-daemon] Client error:', err.message);
});

console.log('[wacli-daemon] Initializing WhatsApp Web...');
client.initialize();

// --- HTTP Server ---
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-sendflow-key');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const url = new URL(req.url, 'http://' + (req.headers.host || 'localhost:' + PORT));
  const pathname = url.pathname;

  try {
    if (pathname === '/status' && req.method === 'GET') {
      sendJSON(res, 200, { connected: clientState === 'CONNECTED', state: clientState });
      return;
    }

    if (pathname === '/qr' && req.method === 'GET') {
      if (clientState !== 'QR_READY' || !qrCode) {
        sendJSON(res, 400, { error: 'No QR code available right now', state: clientState });
        return;
      }
      sendJSON(res, 200, { qr: qrCode, state: clientState });
      return;
    }

    if (pathname === '/connect' && req.method === 'POST') {
      if (clientState === 'CONNECTED') {
        sendJSON(res, 200, { state: clientState, message: 'Already connected' });
        return;
      }
      if (client) client.destroy().catch(() => {});
      setTimeout(() => {
        clientState = 'DISCONNECTED';
        qrCode = null;
        client.initialize();
      }, 1500);
      sendJSON(res, 200, { state: 'RECONNECTING' });
      return;
    }

    if (pathname === '/send' && req.method === 'POST') {
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

        client.sendMessage(formatted, message)
          .then((result) => {
            sendJSON(res, 200, { success: true, messageId: result.id.id });
          })
          .catch((e) => {
            console.error('[wacli-daemon] Send error:', e.message);
            sendJSON(res, 500, { error: e.message });
          });
      });
      return;
    }

    if (pathname === '/' && req.method === 'GET') {
      sendJSON(res, 200, {
        name: 'SendFlow wacli-daemon', version: '1.0.0', state: clientState,
        uptime: process.uptime(),
        endpoints: ['GET /', 'GET /status', 'GET /qr', 'POST /connect', 'POST /send'],
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