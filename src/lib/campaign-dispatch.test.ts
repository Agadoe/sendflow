// Run: npx tsx --test src/lib/campaign-dispatch.test.ts
//
// Tests the ban-critical pure helpers. These must not drift: a wrong delay
// range or a missing rate cap directly risks a WhatsApp ban. The full
// dispatchCampaign() loop is exercised via the local scheduler's dry-run.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getHumanDelay,
  isBusinessHours,
  personalize,
  isDuplicate,
  createRateLimiter,
  MAX_PER_MINUTE,
  MAX_PER_DAY,
} from '@/lib/campaign-dispatch';

// ─── getHumanDelay: cadence ranges (conservative anti-ban, revised 2026-08-17) ─
// 45-120s base; 90-180s every 5th; 180-360s every 10th. The prior 4-12s pacing
// tripped WhatsApp's automation detection (forced LOGOUT after ~26 sends).

test('getHumanDelay: most messages are 45–120s', () => {
  for (const i of [0, 1, 2, 3, 4, 6, 7, 8, 9, 11, 12]) {
    const d = getHumanDelay(i);
    assert.ok(d >= 45000 && d <= 119999, `index ${i}: expected 45000-119999, got ${d}`);
  }
});

test('getHumanDelay: every 5th (not 10th) is 90–180s', () => {
  for (const i of [5, 15, 25, 35]) {
    const d = getHumanDelay(i);
    assert.ok(d >= 90000 && d <= 179999, `index ${i}: expected 90000-179999, got ${d}`);
  }
});

test('getHumanDelay: every 10th is 180–360s', () => {
  for (const i of [10, 20, 30, 40]) {
    const d = getHumanDelay(i);
    assert.ok(d >= 180000 && d <= 359999, `index ${i}: expected 180000-359999, got ${d}`);
  }
});

test('getHumanDelay: always positive and never below 45s', () => {
  for (let i = 0; i < 50; i++) {
    assert.ok(getHumanDelay(i) >= 45000, `index ${i} below 45s`);
  }
});

// ─── isBusinessHours: 08:00–20:00 gate ──────────────────────────────────────

function atHourUTC(hour: number): Date {
  // A UTC instant whose hour (in any tz that is UTC-offset 0) is `hour`.
  const d = new Date();
  d.setUTCHours(hour, 0, 0, 0);
  return d;
}

test('isBusinessHours: 09:00 UTC is within hours', () => {
  assert.equal(isBusinessHours('UTC', atHourUTC(9)), true);
});

test('isBusinessHours: 21:00 UTC is outside hours', () => {
  assert.equal(isBusinessHours('UTC', atHourUTC(21)), false);
});

test('isBusinessHours: 07:59 is outside, 20:00 is outside (hour < 20)', () => {
  assert.equal(isBusinessHours('UTC', atHourUTC(7)), false);
  assert.equal(isBusinessHours('UTC', atHourUTC(20)), false);
});

test('isBusinessHours: invalid timezone falls back to allow (true)', () => {
  assert.equal(isBusinessHours('Not/A/Real_Tz', atHourUTC(3)), true);
});

// ─── personalize: {{name}} + spin ───────────────────────────────────────────

test('personalize: replaces {{name}} and spins the greeting to a known variant', () => {
  // "Hi," is a spin target -> the greeting becomes one of Hi,/Hey,/Hello,
  // randomly (anti-ban variation). The name is always substituted in.
  const out = personalize('Hi, {{name}}!', 'Kofi');
  assert.ok(['Hi, Kofi!', 'Hey, Kofi!', 'Hello, Kofi!'].includes(out), `unexpected: ${out}`);
});

test('personalize: {{name}} falls back to "there" (with greeting spin)', () => {
  const variants = ['Hi, there!', 'Hey, there!', 'Hello, there!'];
  assert.ok(variants.includes(personalize('Hi, {{name}}!', null)), 'null name fallback');
  assert.ok(variants.includes(personalize('Hi, {{name}}!', undefined)), 'undefined name fallback');
});

test('personalize: leaves a message with no tokens structurally intact', () => {
  const out = personalize('Plain message body.', 'Ama');
  assert.equal(out, 'Plain message body.');
});

// ─── isDuplicate: 7-day boundary ─────────────────────────────────────────────

test('isDuplicate: false when no prior message', () => {
  assert.equal(isDuplicate({ lastMessageContent: null, lastMessageSentAt: null }, 'hi'), false);
});

test('isDuplicate: true when same content within 7 days', () => {
  const recent = new Date(Date.now() - 3 * 86_400_000).toISOString(); // 3 days ago
  assert.equal(isDuplicate({ lastMessageContent: 'hi', lastMessageSentAt: recent }, 'hi'), true);
});

test('isDuplicate: false when same content but older than 7 days', () => {
  const old = new Date(Date.now() - 8 * 86_400_000).toISOString(); // 8 days ago
  assert.equal(isDuplicate({ lastMessageContent: 'hi', lastMessageSentAt: old }, 'hi'), false);
});

test('isDuplicate: false when different content within 7 days', () => {
  const recent = new Date(Date.now() - 1 * 86_400_000).toISOString();
  assert.equal(isDuplicate({ lastMessageContent: 'hi', lastMessageSentAt: recent }, 'hello'), false);
});

// ─── Rate limiter: 20/min + 300/day caps ────────────────────────────────────

test('rate limiter: allows up to MAX_PER_MINUTE in one minute', () => {
  const rl = createRateLimiter();
  for (let i = 0; i < MAX_PER_MINUTE; i++) {
    assert.equal(rl.check('u1').ok, true, `should allow #${i + 1}`);
  }
  const over = rl.check('u1');
  assert.equal(over.ok, false);
  assert.match(over.reason || '', /minute/);
});

test('rate limiter: a blocked result carries a numeric retryAfter', () => {
  const rl = createRateLimiter();
  for (let i = 0; i < MAX_PER_MINUTE; i++) rl.check('u1');
  const blocked = rl.check('u1');
  assert.equal(blocked.ok, false);
  assert.equal(typeof blocked.retryAfter, 'number');
  assert.ok((blocked.retryAfter as number) > 0);
});

test('rate limiter: documented ceilings', () => {
  // Anti-ban ceilings — changing these is a policy decision, not a refactor.
  assert.equal(MAX_PER_DAY, 300);
  assert.equal(MAX_PER_MINUTE, 20);
});

test('rate limiter: independent users have independent limits', () => {
  const rl = createRateLimiter();
  for (let i = 0; i < MAX_PER_MINUTE; i++) rl.check('u1');
  assert.equal(rl.check('u1').ok, false);
  // A different user in the same minute is still allowed
  assert.equal(rl.check('u2').ok, true);
});