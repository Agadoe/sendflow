// Arkesel SMS provider (Ghana, https://sms.arkesel.com).
//
// Cheaper Ghana gateway (GHS 0.025/SMS no-expiry, 0.0219 with 3-mo expiry)
// than Sendexa, with the easiest signup (free, no card, live in <5 min).
// Wired in as the default provider after Sendexa.co was unreachable for signup.
//
// Send endpoint: POST /api/v2/sms/send, header `api-key: <key>`,
// body { sender, message, recipients: ["+233..."] }.
// Success: { status: "success", data: { id, credits_used } }.
// Failure shape is undocumented, so the parser is defensive: non-2xx OR a
// status !== "success" ⇒ failure, reason from `message`/`error`/`HTTP <status>`.
import type { SmsSendResult, SmsProvider } from '@/lib/sms/provider';

export const SENDER_DEFAULT = 'SendFlow';
export const ARKESEL_BASE = 'https://sms.arkesel.com';

export function parseArkeselResponse(status: number, data: any): SmsSendResult {
  const ok = status >= 200 && status < 300 && data?.status === 'success';
  if (ok) {
    const messageId = data?.data?.id || data?.id || undefined;
    return { success: true, messageId };
  }
  const reason = (data?.message || data?.error || `HTTP ${status}`).toString();
  return { success: false, reason };
}

export function buildArkeselHeaders(apiKey: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'api-key': apiKey,
  };
}

export function buildArkeselBody(opts: { to: string; message: string; from?: string }): Record<string, any> {
  return {
    sender: opts.from || SENDER_DEFAULT,
    message: opts.message,
    recipients: [opts.to], // Arkesel takes an array, even for one recipient
  };
}

export class ArkeselProvider implements SmsProvider {
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string = ARKESEL_BASE,
    private readonly defaultFrom: string = SENDER_DEFAULT,
  ) {}

  async send(opts: { to: string; message: string; from?: string }): Promise<SmsSendResult> {
    const res = await fetch(`${this.baseUrl}/api/v2/sms/send`, {
      method: 'POST',
      headers: buildArkeselHeaders(this.apiKey),
      body: JSON.stringify(buildArkeselBody({ to: opts.to, message: opts.message, from: opts.from || this.defaultFrom })),
    });
    let data: any = null;
    try { data = await res.json(); } catch { /* non-JSON body */ }
    return parseArkeselResponse(res.status, data);
  }
}