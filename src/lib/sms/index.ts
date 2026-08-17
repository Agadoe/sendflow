// SMS provider factory. Env:
//   SMS_PROVIDER    (default "sendexa") — which gateway to instantiate
//   SMS_API_KEY     the gateway's auth token (Sendexa: dashboard base64 token)
//   SMS_API_BASE    (default "https://api.sendexa.co/v1")
//   SMS_SENDER_ID   (default "SendFlow") — the sender ID SMS comes from
//
// When SMS_API_KEY is absent, returns a NotConfiguredProvider whose send()
// always fails gracefully — so dispatch marks the message FAILED with a clear
// reason instead of throwing (mirrors the old Termii "not configured" path).
import { SendexaProvider } from '@/lib/sms/sendexa';
import { ArkeselProvider, ARKESEL_BASE } from '@/lib/sms/arkesel';
import type { SmsProvider, SmsSendResult } from '@/lib/sms/provider';

export type { SmsProvider, SmsSendResult };

class NotConfiguredProvider implements SmsProvider {
  async send(): Promise<SmsSendResult> {
    return { success: false, reason: 'SMS not configured — set SMS_API_KEY in .env.local' };
  }
}

// Default is "arkesel" (cheaper Ghana gateway; Sendexa.co was unreachable for
// signup). Set SMS_PROVIDER=sendexa to use Sendexa once its dashboard is back.
export function getSmsProvider(): SmsProvider {
  const apiKey = process.env.SMS_API_KEY;
  if (!apiKey) return new NotConfiguredProvider();
  const from = process.env.SMS_SENDER_ID || undefined;
  switch (process.env.SMS_PROVIDER || 'arkesel') {
    case 'sendexa':
      return new SendexaProvider(apiKey, process.env.SMS_API_BASE || 'https://api.sendexa.co/v1', from);
    case 'arkesel':
    default:
      // Arkesel uses its own base; SMS_API_BASE only overrides if explicitly set.
      return new ArkeselProvider(apiKey, process.env.SMS_API_BASE || ARKESEL_BASE, from);
  }
}