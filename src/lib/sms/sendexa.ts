// Sendexa SMS provider (Ghana, https://api.sendexa.co/v1).
//
// Auth: Basic with a single dashboard base64 token (per Sendexa docs root).
// Send endpoint: POST /v1/sms/send  body { to, from, message }.
// Response shape: the /docs/sms page is under construction, so the parser is
// defensive — 2xx ⇒ sent, messageId from `message_id` (fallbacks id/messageId),
// and any `message`/`error` field on a non-2xx ⇒ failure reason. The real
// contract is locked by the live test SMS at the end of the build; if Sendexa
// returns a different shape, only parseSendexaResponse changes.
import type { SmsSendResult, SmsProvider } from '@/lib/sms/provider';

export const SENDER_DEFAULT = 'SendFlow';

export function parseSendexaResponse(status: number, data: any): SmsSendResult {
  const ok = status >= 200 && status < 300;
  if (ok) {
    const messageId = data?.message_id || data?.id || data?.messageId || undefined;
    return { success: true, messageId };
  }
  const reason = (data?.message || data?.error || `HTTP ${status}`).toString();
  return { success: false, reason };
}

export function buildSendexaHeaders(apiKey: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Basic ${apiKey}`,
  };
}

export function buildSendexaBody(opts: { to: string; message: string; from?: string }): Record<string, string> {
  return { to: opts.to, from: opts.from || SENDER_DEFAULT, message: opts.message };
}

// cost preview only — never sent to the provider
export function estimateSmsCost(recipientCount: number, ratePerSms?: number): number {
  if (!ratePerSms || ratePerSms <= 0) return 0;
  return Math.round(recipientCount * ratePerSms * 100) / 100;
}

export class SendexaProvider implements SmsProvider {
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string = 'https://api.sendexa.co/v1',
    private readonly defaultFrom: string = SENDER_DEFAULT,
  ) {}

  async send(opts: { to: string; message: string; from?: string }): Promise<SmsSendResult> {
    const res = await fetch(`${this.baseUrl}/sms/send`, {
      method: 'POST',
      headers: buildSendexaHeaders(this.apiKey),
      body: JSON.stringify(buildSendexaBody({ to: opts.to, message: opts.message, from: opts.from || this.defaultFrom })),
    });
    let data: any = null;
    try { data = await res.json(); } catch { /* non-JSON body */ }
    return parseSendexaResponse(res.status, data);
  }
}