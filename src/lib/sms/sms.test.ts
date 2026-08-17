// Run: npx tsx --test src/lib/sms/sms.test.ts
//
// Tests the pure helpers of the SMS provider layer. The actual HTTP fetch is
// thin; the contract lives in response parsing, request building, the provider
// factory, and cost math — all pure and deterministic. The Sendexa response
// shape is best-effort from their docs (the /docs/sms page is under
// construction) and is locked by the live test SMS at the end of the build.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseSendexaResponse,
  buildSendexaHeaders,
  buildSendexaBody,
  estimateSmsCost,
  SendexaProvider,
} from '@/lib/sms/sendexa';
import {
  parseArkeselResponse,
  buildArkeselHeaders,
  buildArkeselBody,
  ArkeselProvider,
} from '@/lib/sms/arkesel';
import { getSmsProvider } from '@/lib/sms';
import { sendViaSms } from '@/lib/campaign-dispatch';

// ─── parseSendexaResponse ──────────────────────────────────────────────────

test('parseSendexaResponse: 2xx with message_id → success, messageId set', () => {
  const r = parseSendexaResponse(200, { message_id: 'msg_01J8XVZ9KQMNPRTX4Y7GBW2C3D' });
  assert.equal(r.success, true);
  assert.equal(r.messageId, 'msg_01J8XVZ9KQMNPRTX4Y7GBW2C3D');
  assert.equal(r.reason, undefined);
});

test('parseSendexaResponse: 2xx with no message_id → success true, messageId undefined', () => {
  // Sendexa may return 200 with no id field on some routes; treat as sent.
  const r = parseSendexaResponse(200, { status: 'ok' });
  assert.equal(r.success, true);
  assert.equal(r.messageId, undefined);
});

test('parseSendexaResponse: non-2xx with message → failure with reason', () => {
  const r = parseSendexaResponse(400, { message: 'Invalid sender ID' });
  assert.equal(r.success, false);
  assert.equal(r.reason, 'Invalid sender ID');
});

test('parseSendexaResponse: non-2xx with no message → reason is HTTP status', () => {
  const r = parseSendexaResponse(500, {});
  assert.equal(r.success, false);
  assert.match(r.reason || '', /HTTP 500/);
});

// ─── buildSendexaHeaders / buildSendexaBody ─────────────────────────────────

test('buildSendexaHeaders: uses Basic auth with the raw key, JSON content type', () => {
  const h = buildSendexaHeaders('abc123');
  assert.equal(h['Authorization'], 'Basic abc123');
  assert.equal(h['Content-Type'], 'application/json');
});

test('buildSendexaBody: carries to/from/message', () => {
  const b = buildSendexaBody({ to: '+233551234567', message: 'Hi there', from: 'SendFlow' });
  assert.equal(b.to, '+233551234567');
  assert.equal(b.from, 'SendFlow');
  assert.equal(b.message, 'Hi there');
});

// ─── estimateSmsCost ───────────────────────────────────────────────────────

test('estimateSmsCost: count × rate, rounded to 2 decimals', () => {
  assert.equal(estimateSmsCost(208, 0.012), 2.5);
});

test('estimateSmsCost: zero when rate is 0 or missing', () => {
  assert.equal(estimateSmsCost(208, 0), 0);
  assert.equal(estimateSmsCost(208, undefined), 0);
});

// ─── getSmsProvider factory ─────────────────────────────────────────────────

test('getSmsProvider: no SMS_API_KEY → fails gracefully with "not configured"', async () => {
  const had = process.env.SMS_API_KEY;
  delete process.env.SMS_API_KEY;
  try {
    const r = await getSmsProvider().send({ to: '+233551234567', message: 'hi' });
    assert.equal(r.success, false);
    assert.match(r.reason || '', /not configured/);
  } finally {
    if (had) process.env.SMS_API_KEY = had;
  }
});

test('getSmsProvider: with SMS_API_KEY → SendexaProvider instance', () => {
  const hadKey = process.env.SMS_API_KEY;
  const hadProv = process.env.SMS_PROVIDER;
  process.env.SMS_API_KEY = 'test-key';
  process.env.SMS_PROVIDER = 'sendexa';
  try {
    assert.ok(getSmsProvider() instanceof SendexaProvider);
  } finally {
    if (hadKey) process.env.SMS_API_KEY = hadKey; else delete process.env.SMS_API_KEY;
    if (hadProv) process.env.SMS_PROVIDER = hadProv; else delete process.env.SMS_PROVIDER;
  }
});

// ─── sendViaSms transport contract ──────────────────────────────────────────
// dispatchCampaign's catch block marks a Message FAILED only when the transport
// throws. So sendViaSms must throw on provider failure and resolve on success —
// the same contract sendViaDaemon has (throw on !res.ok). Provider is injected.

test('sendViaSms: throws on provider failure (so dispatch marks FAILED)', async () => {
  const fake = { send: async () => ({ success: false, reason: 'Invalid sender ID' }) };
  await assert.rejects(sendViaSms('+233551234567', 'hi', fake as any), /Invalid sender ID/);
});

test('sendViaSms: resolves on provider success (no throw)', async () => {
  const fake = { send: async () => ({ success: true, messageId: 'msg_1' }) };
  await sendViaSms('+233551234567', 'hi', fake as any); // should not throw
});

// ─── Arkesel provider (cheaper Ghana gateway, Sendexa signup was down) ────────
// Sendexa.co was unreachable for signup, so Arkesel is the default provider.
// API: POST https://sms.arkesel.com/api/v2/sms/send, header `api-key`, body
// { sender, message, recipients: [...] }, success { status:'success', data:{id} }.

test('parseArkeselResponse: status==="success" + data.id → success', () => {
  const r = parseArkeselResponse(200, { status: 'success', data: { id: 'msg_9f8k2j', credits_used: 1 } });
  assert.equal(r.success, true);
  assert.equal(r.messageId, 'msg_9f8k2j');
});

test('parseArkeselResponse: non-success status → failure with reason', () => {
  const r = parseArkeselResponse(200, { status: 'failed', message: 'Insufficient credits' });
  assert.equal(r.success, false);
  assert.match(r.reason || '', /Insufficient credits/);
});

test('parseArkeselResponse: non-2xx with message → failure with reason', () => {
  const r = parseArkeselResponse(400, { message: 'Invalid sender ID' });
  assert.equal(r.success, false);
  assert.match(r.reason || '', /Invalid sender ID/);
});

test('parseArkeselResponse: non-2xx with no message → reason is HTTP status', () => {
  const r = parseArkeselResponse(500, {});
  assert.equal(r.success, false);
  assert.match(r.reason || '', /HTTP 500/);
});

test('buildArkeselHeaders: uses the api-key header, JSON content type', () => {
  const h = buildArkeselHeaders('ark-key-123');
  assert.equal(h['api-key'], 'ark-key-123');
  assert.equal(h['Content-Type'], 'application/json');
});

test('buildArkeselBody: wraps to in a recipients array, uses sender', () => {
  const b = buildArkeselBody({ to: '+233551234567', message: 'Hi', from: 'SendFlow' });
  assert.deepEqual(b.recipients, ['+233551234567']);
  assert.equal(b.sender, 'SendFlow');
  assert.equal(b.message, 'Hi');
});

test('getSmsProvider: SMS_PROVIDER=arkesel → ArkeselProvider instance', () => {
  const hadKey = process.env.SMS_API_KEY;
  const hadProv = process.env.SMS_PROVIDER;
  process.env.SMS_API_KEY = 'ark-key';
  process.env.SMS_PROVIDER = 'arkesel';
  try {
    assert.ok(getSmsProvider() instanceof ArkeselProvider);
  } finally {
    if (hadKey) process.env.SMS_API_KEY = hadKey; else delete process.env.SMS_API_KEY;
    if (hadProv) process.env.SMS_PROVIDER = hadProv; else delete process.env.SMS_PROVIDER;
  }
});