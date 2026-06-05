/**
 * Paystack API client — thin wrapper around the REST API.
 *
 * Env vars:
 *   PAYSTACK_SECRET_KEY  — sk_test_... or sk_live_...
 *   PAYSTACK_PUBLIC_KEY  — pk_test_... or pk_live_... (sent to client)
 *   NEXT_PUBLIC_APP_URL  — used to build return URLs (https://sendflow-two.vercel.app)
 *
 * Docs: https://paystack.com/docs/api/
 */

export interface PaystackPlan {
  name: string;
  code: string; // STARTER / GROWTH / PRO
  amountKobo: number; // Paystack amounts are in kobo (GHS 1 = 100)
  interval: 'monthly';
  features: string[];
  popular?: boolean;
}

/**
 * Canonical plan list — single source of truth, used by /subscribe and
 * /api/paystack/initialize. Amounts in GHS (display); we convert to kobo.
 */
export const PLANS: PaystackPlan[] = [
  {
    name: 'Starter',
    code: 'STARTER',
    amountKobo: 29900,
    interval: 'monthly',
    features: [
      '500 messages/month',
      '2,000 contacts',
      '2 users',
      'Delivery reports',
      'CSV import',
      'Email support',
    ],
    popular: true,
  },
  {
    name: 'Growth',
    code: 'GROWTH',
    amountKobo: 79900,
    interval: 'monthly',
    features: [
      '3,000 messages/month',
      '10,000 contacts',
      '5 users',
      'Delivery reports',
      'CSV import',
      'Media messages',
      'Priority support',
    ],
  },
  {
    name: 'Pro',
    code: 'PRO',
    amountKobo: 199900,
    interval: 'monthly',
    features: [
      '20,000 messages/month',
      'Unlimited contacts',
      'Unlimited users',
      'Delivery reports',
      'API access',
      'Dedicated support',
    ],
  },
];

export function getPlan(code: string): PaystackPlan | null {
  return PLANS.find(p => p.code === code.toUpperCase()) || null;
}

const BASE = 'https://api.paystack.co';

/**
 * Generic Paystack request. Throws on non-2xx with a clear error.
 */
async function paystackFetch<T = any>(
  path: string,
  init: RequestInit = {}
): Promise<{ status: boolean; message: string; data: T }> {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) {
    throw new Error('PAYSTACK_SECRET_KEY is not set in environment');
  }
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
    // Paystack webhooks need raw body, but this is for non-webhook calls.
    cache: 'no-store',
  });
  const json = (await res.json()) as { status: boolean; message: string; data: T };
  if (!res.ok || !json.status) {
    throw new Error(`Paystack ${path} failed: ${json.message || res.statusText}`);
  }
  return json;
}

/**
 * Initialize a transaction. Returns the authorization URL the user should be
 * redirected to.
 * Docs: https://paystack.com/docs/api/transaction/#initialize
 */
export async function initializeTransaction(params: {
  email: string;
  amountKobo: number;
  planCode: string; // STARTER | GROWTH | PRO — stored in metadata
  userId: string;
  callbackUrl: string;
}) {
  return paystackFetch<{ authorization_url: string; reference: string }>(
    '/transaction/initialize',
    {
      method: 'POST',
      body: JSON.stringify({
        email: params.email,
        amount: params.amountKobo,
        callback_url: params.callbackUrl,
        metadata: {
          plan_code: params.planCode,
          user_id: params.userId,
          custom_fields: [
            {
              display_name: 'Plan',
              variable_name: 'plan',
              value: params.planCode,
            },
          ],
        },
      }),
    }
  );
}

/**
 * Verify a transaction by reference. Used by the success page after redirect.
 * Docs: https://paystack.com/docs/api/transaction/#verify
 */
export async function verifyTransaction(reference: string) {
  return paystackFetch<{
    reference: string;
    amount: number;
    status: string;
    metadata: { plan_code?: string; user_id?: string };
    customer: { email: string };
  }>(`/transaction/verify/${encodeURIComponent(reference)}`);
}

/**
 * Verify webhook signature. Returns true if the signature matches.
 * Uses HMAC-SHA256 with PAYSTACK_SECRET_KEY.
 */
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) return false;
  // Use Node's crypto for HMAC. Web Crypto API doesn't expose HMAC directly
  // in edge runtime; this route runs on Node, so it's safe.
  // Lazy import so this file works in edge middleware too.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const crypto = require('crypto') as typeof import('crypto');
  const expected = crypto
    .createHmac('sha512', key)
    .update(rawBody)
    .digest('hex');
  return expected === signature;
}
