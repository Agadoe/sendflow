#!/usr/bin/env node
// Apply the campaign.channel migration to prod Turso.
// Self-contained: loads TURSO_DATABASE_URL from .env.local. Idempotent —
// "duplicate column" / "already exists" errors are treated as warnings.
// Mirrors scripts/apply-20260709-segments.js (the project's established
// DDL-to-Turso path; Prisma CLI db push can't target a libsql URL).
const { createClient } = require('@libsql/client');
const fs = require('fs');
const path = require('path');

// ── Load .env.local (manual, dotenv-free) — mirrors local-scheduler.ts ──
try {
  for (const line of fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(?:"([^"]*)"|(.+?))\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2] ?? m[3] ?? '';
  }
} catch (e) {
  console.error('WARNING: could not load .env.local:', e.message);
}

function splitSql(raw) {
  // Strip line comments, then split on top-level ; (not inside parens/strings).
  let cleaned = '';
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (c === '-' && raw[i + 1] === '-') { while (i < raw.length && raw[i] !== '\n') i++; continue; }
    cleaned += c;
  }
  const out = [];
  let buf = '', depth = 0, inString = false, strChar = '';
  for (let i = 0; i < cleaned.length; i++) {
    const c = cleaned[i];
    if (inString) { buf += c; if (c === strChar && cleaned[i - 1] !== '\\') inString = false; continue; }
    if (c === "'" || c === '"') { inString = true; strChar = c; buf += c; continue; }
    if (c === '(') depth++;
    if (c === ')') depth--;
    if (c === ';' && depth === 0) { const s = buf.trim(); if (s) out.push(s); buf = ''; continue; }
    buf += c;
  }
  const last = buf.trim();
  if (last) out.push(last);
  return out.filter((s) => s.length > 0);
}

(async () => {
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) { console.error('Missing TURSO_DATABASE_URL'); process.exit(1); }
  const db = createClient({ url });
  const file = path.join(__dirname, '..', 'prisma/migrations/20260817_add_campaign_channel/migration.sql');
  const stmts = splitSql(fs.readFileSync(file, 'utf-8'));
  console.log('Statements to run: ' + stmts.length);
  for (let i = 0; i < stmts.length; i++) {
    const s = stmts[i];
    const preview = s.slice(0, 80).replace(/\n/g, ' ');
    try {
      await db.execute(s);
      console.log('  [' + (i + 1) + '/' + stmts.length + '] OK: ' + preview);
    } catch (e) {
      const msg = e.message || '';
      if (msg.includes('duplicate column') || msg.includes('already exists')) {
        console.log('  [' + (i + 1) + '/' + stmts.length + '] SKIP (idempotent): ' + preview);
        continue;
      }
      console.error('  [' + (i + 1) + '/' + stmts.length + '] FAIL: ' + preview);
      console.error('     error: ' + msg);
      process.exit(1);
    }
  }
  // Verify
  const cols = await db.execute('PRAGMA table_info(Campaign)');
  const has = cols.rows.some((r) => r[1] === 'channel');
  console.log('\nCampaign.channel column: ' + (has ? 'YES' : 'NO'));
  if (has) {
    const sample = await db.execute("SELECT channel, COUNT(*) AS n FROM Campaign GROUP BY channel");
    console.log('Existing campaigns by channel:');
    sample.rows.forEach((r) => console.log('  - ' + r[0] + ': ' + r[1]));
  }
})();