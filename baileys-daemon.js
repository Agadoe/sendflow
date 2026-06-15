#!/usr/bin/env node
/**
 * SendFlow WhatsApp Daemon — Baileys Edition
 * Lightweight WhatsApp Web API using Baileys (no Puppeteer)
 * 
 * Endpoints:
 *   GET  /health        → { ok: true }
 *   GET  /qr            → { qr: base64png } (while scanning) or { state }
 *   GET  /status        → { connected, state, info }
 *   POST /send           → { phone, message }
 *   POST /connect        → start/reconnect
 *   POST /disconnect    → logout
 */

const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys');
const pino = require('pino');
const http = require('http');
const path = require('path');
const os = require('os');
const fs = require('fs');

const PORT = parseInt(process.env.WACLI_PORT || '4555');
const AUTH_DIR = path.join(os.homedir(), '.wacli_baileys');

if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });

let sock = null;
let qrBuffer = null;       // base64 PNG
let connectionState = 'initializing';
let sessionInfo = null;

const log = (level, ...args) => {
  const ts = new Date().toISOString();
  console[level](`[baileys-daemon ${ts}]`, ...args);
};

// ─── Start WhatsApp Socket ─────────────────────────────────────────
async function startSocket() {
  connectionState = 'STARTING';
  log('info', 'Starting Baileys socket...');

  try {
    const { version, isLatest } = await fetchLatestBaileysVersion();
    log('info', `Using Baileys v${version}, isLatest: ${isLatest}`);

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

    sock = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, pino().child({ level: 'fatal' })),
      },
      printQRInTerminal: true,
      logger: pino({ level: 'fatal' }),
      browser: ['SendFlow', 'Ubuntu', '2.0'],
      getMessage: async () => ({}),
    });

    // ── QR Event ──────────────────────────────────────────────────
    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async ({ qr, connection, lastDisconnect }) => {
      log('info', 'Connection update:', { connection, qr: qr ? 'PRESENT' : 'NONE' });

      if (qr) {
        // Generate QR as base64 PNG
        try {
          const QRCode = require('qrcode');
          qrBuffer = await QRCode.toDataURL(qr, { width: 300, margin: 2 });
          connectionState = 'QR_READY';
          log('info', 'QR generated, scan to authenticate');
        } catch (e) {
          log('error', 'QR generation failed:', e.message);
        }
      }

      if (connection === 'open') {
        qrBuffer = null;
        connectionState = 'CONNECTED';
        sessionInfo = {
          wid: sock.user?.id,
          pushName: sock.user?.name || sock.user?.pushName,
        };
        log('info', '✅ WhatsApp connected:', sessionInfo);
      }

      if (connection === 'close') {
        const reason = lastDisconnect?.error?.output?.statusCode || 'unknown';
        log('warn', 'Connection closed, reason:', reason, lastDisconnect?.error?.message);
        qrBuffer = null;
        connectionState = 'DISCONNECTED';
        // Auto-reconnect after 5s
        setTimeout(() => {
          log('info', 'Reconnecting...');
          startSocket();
        }, 5000);
      }
    });

    sock.ev.on('messages.upsert', ({ messages }) => {
      // Handle incoming messages if needed
    });

  } catch (e) {
    log('error', 'Socket start error:', e.message);
    connectionState = 'ERROR';
    setTimeout(startSocket, 5000);
  }
}

// ─── Send Message ───────────────────────────────────────────────────
async function sendWA(phone, message) {
  if (!sock || connectionState !== 'CONNECTED') {
    throw new Error(`Not connected — state: ${connectionState}`);
  }

  const clean = (phone || '').replace(/\D/g, '');
  const jidOnly = clean.startsWith('0') ? clean.slice(1) : clean.replace('+','');
  const formatted = jidOnly.includes('@') ? jidOnly : `${jidOnly}@s.whatsapp.net`;

  log('info', `Sending to ${formatted}, len:${message.length}`);
  const result = await sock.sendMessage(formatted, { text: message });
  log('info', 'Sent:', result.key?.id);
  return { success: true, id: result.key?.id };
}

// ─── HTTP Server ────────────────────────────────────────────────────
function json(res, code, data) {
  res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const p = url.pathname;

  try {
    // Health
    if (p === '/health') return json(res, 200, { ok: true });

    // Status
    if (p === '/status') {
      return json(res, 200, {
        connected: connectionState === 'CONNECTED',
        state: connectionState,
        info: sessionInfo,
      });
    }

    // QR
    if (p === '/qr') {
      if (connectionState === 'CONNECTED') return json(res, 200, { state: 'CONNECTED', qr: null });
      if (qrBuffer) return json(res, 200, { state: 'QR_READY', qr: qrBuffer });
      return json(res, 200, { state: connectionState, qr: null });
    }

    // Connect
    if (p === '/connect' && req.method === 'POST') {
      qrBuffer = null;
      if (sock) { try { sock.end(); } catch {} }
      await startSocket();
      return json(res, 200, { success: true, state: connectionState });
    }

    if (p === '/connect' && req.method === 'GET') {
      return json(res, 200, {
        connected: connectionState === 'CONNECTED',
        state: connectionState,
        qr: qrBuffer,
        info: sessionInfo,
      });
    }

    // Disconnect
    if (p === '/disconnect' && req.method === 'POST') {
      if (sock) { try { sock.end(); } catch {} }
      qrBuffer = null;
      connectionState = 'DISCONNECTED';
      sock = null;
      return json(res, 200, { success: true, state: 'DISCONNECTED' });
    }

    // Send
    if (p === '/send' && req.method === 'POST') {
      let body = ''; for await (const c of req) body += c;
      const { phone, message } = JSON.parse(body);
      if (!phone || !message) return json(res, 400, { error: 'phone and message required' });
      try {
        const result = await sendWA(phone, message);
        return json(res, 200, result);
      } catch (e) {
        return json(res, 500, { error: e.message, state: connectionState });
      }
    }

    json(res, 404, { error: 'Not found' });
  } catch (e) {
    json(res, 500, { error: e.message });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  log('info', `🚀 Baileys daemon listening on port ${PORT}`);
  startSocket();
});

process.on('SIGTERM', () => { log('info', 'SIGTERM'); if (sock) sock.end(); process.exit(0); });
process.on('SIGINT', () => { log('info', 'SIGINT'); if (sock) sock.end(); process.exit(0); });