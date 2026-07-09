#!/usr/bin/env node
// Apply the segments migration to prod Turso.
// Splits the SQL file on top-level semicolons (not inside parens) and runs
// each statement individually via libsql. Idempotent — duplicate errors
// are treated as warnings.

const { createClient } = require('@libsql/client');
const fs = require('fs');
const path = require('path');

function splitSql(raw) {
  // First strip line comments. Walk char-by-char so we don't break strings.
  let cleaned = '';
  let i = 0;
  while (i < raw.length) {
    const c = raw[i];
    if (c === '-' && raw[i + 1] === '-') {
      // Skip to end of line
      while (i < raw.length && raw[i] !== '\n') i++;
      continue;
    }
    cleaned += c;
    i++;
  }
  // Then split on top-level ;
  const out = [];
  let buf = '';
  let depth = 0;
  let inString = false;
  let strChar = '';
  for (let i = 0; i < cleaned.length; i++) {
    const c = cleaned[i];
    if (inString) {
      buf += c;
      if (c === strChar && cleaned[i - 1] !== '\\') {
        inString = false;
      }
      continue;
    }
    if (c === "'" || c === '"') {
      inString = true;
      strChar = c;
      buf += c;
      continue;
    }
    if (c === '(') depth++;
    if (c === ')') depth--;
    if (c === ';' && depth === 0) {
      const s = buf.trim();
      if (s) out.push(s);
      buf = '';
      continue;
    }
    buf += c;
  }
  const last = buf.trim();
  if (last) out.push(last);
  return out.filter((s) => s.length > 0);
}

(async () => {
  // The Turso URL embeds the auth token as ?authToken=...; no separate
  // TURSO_AUTH_TOKEN env var is set on Vercel.
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) {
    console.error('Missing TURSO_DATABASE_URL (source it from .env.prod)');
    process.exit(1);
  }
  const db = createClient({ url });
  const file = path.join(__dirname, '..', 'prisma/migrations/20260709_add_segments/migration.sql');
  const raw = fs.readFileSync(file, 'utf-8');
  const stmts = splitSql(raw);
  console.log('Statements to run: ' + stmts.length);
  for (let i = 0; i < stmts.length; i++) {
    const s = stmts[i];
    const preview = s.slice(0, 80).replace(/\n/g, ' ');
    try {
      await db.execute(s);
      console.log('  [' + (i + 1) + '/' + stmts.length + '] OK: ' + preview);
    } catch (e) {
      const msg = e.message || '';
      if (
        msg.includes('duplicate column') ||
        msg.includes('already exists') ||
        msg.includes('UNIQUE constraint failed') // from re-running seed (we use NOT EXISTS but the seed subquery is a guard)
      ) {
        console.log('  [' + (i + 1) + '/' + stmts.length + '] SKIP (idempotent): ' + preview);
        continue;
      }
      console.error('  [' + (i + 1) + '/' + stmts.length + '] FAIL: ' + preview);
      console.error('     error: ' + msg);
      process.exit(1);
    }
  }
  // Verify
  const tabs = await db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='Segment'");
  console.log('\nSegment table exists: ' + (tabs.rows.length > 0 ? 'YES' : 'NO'));
  if (tabs.rows.length) {
    const cols = await db.execute('PRAGMA table_info(Segment)');
    cols.rows.forEach((r) => console.log('  ' + r[1] + ' ' + r[2]));
  }
  const campCols = await db.execute('PRAGMA table_info(Campaign)');
  const hasSegIds = campCols.rows.some((r) => r[1] === 'segmentIds');
  console.log('Campaign.segmentIds column: ' + (hasSegIds ? 'YES' : 'NO'));
  const segs = await db.execute('SELECT name, tag, color, userId FROM Segment');
  console.log('Seeded segments: ' + segs.rows.length);
  segs.rows.forEach((r) => console.log('  - ' + r[0] + ' | tag=' + r[1] + ' | color=' + r[2] + ' | user=' + r[3]));
})();
