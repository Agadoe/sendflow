#!/usr/bin/env node
/**
 * SendFlow wacli-daemon — Fixed version
 * Uses bundled wacli modules + correct chromium path
 * 
 * Endpoints:
 *   GET  /qr        → base64 QR image (or existing session)
 *   GET  /status    → { connected: bool, state: string }
 *   POST /send      → { phone, message } → send WhatsApp
 *   GET  /sessions  → list stored sessions
 *   POST /connect   → regenerate QR / reconnect
 *   POST /disconnect → logout WhatsApp
 */

const http = require('http');
const path = require('path');
const os = require('os');
const fs = require('fs');

// Use wacli's bundled modules
const WACLI_MODULES = '/usr/lib/node_modules/@adityakul0314/wacli/node_modules';
const { Client, LocalAuth } = require(path.join(WACLI_MODULES, 'whatsapp-web.js'));
const qrcode = require(path.join(WACLI_MODULES, 'qrcode-terminal'));

const PORT = parseInt(process.env.WACLI_PORT || '4555');
const AUTH_DIR = path.join(os.homedir(), '.wacli_auth');

// Ensure auth dir exists
if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });

let client = null;
let qrCache = null;        // base64 PNG for current QR
let clientState = 'STARTING';
let sessionInfo = null;

function log(...args) {
  const ts = new Date().toISOString();
  console.log(`[wacli-daemon ${ts}]`, ...args);
}

// ─── WhatsApp Client Setup ───────────────────────────────────────────
function createClient() {
  log('Creating WhatsApp client with auth at:', AUTH_DIR);

  const puppeteerOpts = {
    headless: true,
    executablePath: '/usr/bin/chromium-browser',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-software-rasterizer',
      '--disable-web-security',
      '--disable-user-media',
      '--ignore-certificate-errors',
      '--allow-running-insecure-content',
      '--disable-webgl',
    ],
  };

  try {
    client = new Client({
      authStrategy: new LocalAuth({
        dataPath: AUTH_DIR,
      }),
      puppeteer: puppeteerOpts,
    });
  } catch (e) {
    log('Failed to create client:', e.message);
    clientState = 'ERROR';
    return;
  }

  // ── QR Event ──────────────────────────────────────────────────────
  client.on('qr', (qr) => {
    log('📷 QR received — encoding...');
    qrcode.generate(qr, { small: true });
    qrCache = qr; // raw QR string for terminal display
    clientState = 'QR_READY';
  });

  // ── Ready ─────────────────────────────────────────────────────────
  client.on('ready', () => {
    const info = client.info;
    sessionInfo = {
      wid: info?.wid,
      pushName: info?.pushName,
      platform: info?.platform,
    };
    log('✅ WhatsApp READY —', sessionInfo.pushName, sessionInfo.wid);
    qrCache = null;
    clientState = 'CONNECTED';
  });

  // ── Authenticated ─────────────────────────────────────────────────
  client.on('authenticated', () => {
    log('🔐 Authenticated — session saved');
  });

  // ── Disconnected ───────────────────────────────────────────────────
  client.on('disconnected', (reason) => {
    log('⚠️ Disconnected:', reason);
    clientState = 'DISCONNECTED';
    qrCache = null;
    // Auto-reinitialize after 5s
    setTimeout(() => {
      log('Reinitializing client...');
      clientState = 'RECONNECTING';
      initClient();
    }, 5000);
  });

  // ── Message Ack ────────────────────────────────────────────────────
  client.on('message_ack', (msg, ack) => {
    // Log ack: 1=pending, 2=sent, 3=delivered, 4=read
  });

  client.on('auth_failure', (err) => {
    log('❌ Auth failure:', err);
    clientState = 'AUTH_FAILED';
  });

  client.on('change_state', (state) => {
    log('State changed:', state);
  });

  log('Initializing WhatsApp client...');
  clientState = 'INITIALIZING';
  client.initialize().catch(e => {
    log('Initialize error:', e.message);
    clientState = 'ERROR';
  });
}

// ─── Phone Formatter ─────────────────────────────────────────────────
function formatPhone(phone) {
  const clean = (phone || '').replace(/\D/g, '');
  if (clean.startsWith('0')) return `+233${clean.slice(1)}`;
  if (clean.startsWith('233')) return `+${clean}`;
  if (clean.startsWith('+')) return clean;
  return `+233${clean}`;
}

// ─── Send Message ─────────────────────────────────────────────────────
async function sendMessage(phone, message) {
  if (!client || clientState !== 'CONNECTED') {
    throw new Error(`Client not ready — state: ${clientState}`);
  }
  const formatted = formatPhone(phone);
  log('Sending to:', formatted, '| length:', message.length);
  const result = await client.sendMessage(formatted, message);
  log('Sent. ID:', result.id._serialized);
  return { success: true, id: result.id._serialized, status: 'sent' };
}

// ─── HTTP Server ─────────────────────────────────────────────────────
function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-cache',
  });
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;

  // ── Health ──────────────────────────────────────────────────────
  if (path === '/health') {
    return sendJSON(res, 200, { ok: true, uptime: process.uptime() });
  }

  // ── Status ──────────────────────────────────────────────────────
  if (path === '/status') {
    const connected = clientState === 'CONNECTED' && client?.info?.me;
    return sendJSON(res, 200, {
      connected: !!connected,
      state: clientState,
      info: sessionInfo || null,
    });
  }

  // ── QR ──────────────────────────────────────────────────────────
  if (path === '/qr') {
    if (clientState === 'CONNECTED') {
      return sendJSON(res, 200, { state: 'CONNECTED', qr: null });
    }
    if (clientState === 'QR_READY' && qrCache) {
      return sendJSON(res, 200, { state: 'QR_READY', qr: qrCache });
    }
    // Trigger new QR if no session
    if (!client) {
      createClient();
      return sendJSON(res, 200, { state: 'INITIALIZING', qr: null });
    }
    return sendJSON(res, 200, { state: clientState, qr: null });
  }

  // ── Connect / Reconnect ─────────────────────────────────────────
  if (path === '/connect' && req.method === 'POST') {
    log('Reconnect requested');
    qrCache = null;
    if (client) {
      try { client.destroy(); } catch (e) {}
      client = null;
    }
    createClient();
    return sendJSON(res, 200, { success: true, state: 'INITIALIZING' });
  }

  if (path === '/connect' && req.method === 'GET') {
    if (clientState === 'CONNECTED') {
      return sendJSON(res, 200, { state: 'CONNECTED', connected: true });
    }
    if (clientState === 'QR_READY' && qrCache) {
      return sendJSON(res, 200, { state: 'QR_READY', qr: qrCache });
    }
    return sendJSON(res, 200, { state: clientState, qr: null });
  }

  // ── Disconnect ───────────────────────────────────────────────────
  if (path === '/disconnect' && req.method === 'POST') {
    log('Disconnect requested');
    if (client) {
      client.destroy();
      client = null;
    }
    qrCache = null;
    clientState = 'DISCONNECTED';
    return sendJSON(res, 200, { success: true, state: 'DISCONNECTED' });
  }

  // ── Send ─────────────────────────────────────────────────────────
  if (path === '/send' && req.method === 'POST') {
    try {
      let body = '';
      for await (const chunk of req) { body += chunk; }
      const { phone, message } = JSON.parse(body);

      if (!phone || !message) {
        return sendJSON(res, 400, { error: 'phone and message required' });
      }

      const result = await sendMessage(phone, message);
      return sendJSON(res, 200, result);
    } catch (e) {
      log('Send error:', e.message);
      return sendJSON(res, 500, { error: e.message, state: clientState });
    }
  }

  // ── Sessions (list) ─────────────────────────────────────────────
  if (path === '/sessions') {
    const authDirContents = fs.readdirSync(AUTH_DIR).filter(
      f => fs.statSync(path.join(AUTH_DIR, f)).isDirectory()
    );
    return sendJSON(res, 200, { sessions: authDirContents, current: clientState });
  }

  // 404
  sendJSON(res, 404, { error: 'Not found', path });
});

// ─── Start ────────────────────────────────────────────────────────────
server.listen(PORT, '0.0.0.0', () => {
  log(`🚀 wacli-daemon listening on port ${PORT}`);
  createClient();
});

process.on('SIGTERM', () => {
  log('SIGTERM — shutting down gracefully');
  if (client) client.destroy();
  server.close();
});

process.on('SIGINT', () => {
  log('SIGINT — shutting down');
  if (client) client.destroy();
  process.exit(0);
});