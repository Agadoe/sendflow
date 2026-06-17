import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyWebhookSignature, getPlan } from '@/lib/paystack';

/**
 * POST /api/paystack/webhook
 *
 * Receives events from Paystack. The only event we care about is
 * `charge.success`, but we accept all events for logging.
 *
 * On `charge.success`:
 *   1. Verify HMAC-SHA512 signature against PAYSTACK_SECRET_KEY
 *   2. Idempotently create a Payment row (unique on `ref`)
 *   3. Update the user's plan to match the metadata.plan_code
 *
 * This route runs on Node.js (default) so we can read the raw body
 * for signature verification. Vercel auto-buffers; we need the raw
 * text, not parsed JSON.
 */
export async function POST(req: NextRequest) {
  try {
    // Read the raw body for signature verification.
    const rawBody = await req.text();
    const signature = req.headers.get('x-paystack-signature') || '';

    if (!verifyWebhookSignature(rawBody, signature)) {
      console.warn('Paystack webhook: bad signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    let event: { event: string; data: any };
    try {
      event = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    // Handle charge.success
    if (event.event === 'charge.success') {
      const data = event.data;
      const ref = data.reference as string;
      const amount = data.amount as number; // kobo
      const planCode = (data.metadata?.plan_code as string) || '';
      const userId = (data.metadata?.user_id as string) || '';
      const email = (data.customer?.email as string) || '';

      // Validate plan exists; reject mismatched amounts.
      const plan = getPlan(planCode);
      if (!plan) {
        console.warn('Paystack webhook: unknown plan', planCode);
        return NextResponse.json({ ok: true, skipped: 'unknown plan' });
      }
      if (amount !== plan.amountKobo) {
        console.warn('Paystack webhook: amount mismatch', { ref, amount, expected: plan.amountKobo });
        return NextResponse.json({ ok: true, skipped: 'amount mismatch' });
      }
      if (!userId) {
        console.warn('Paystack webhook: missing user_id metadata', ref);
        return NextResponse.json({ ok: true, skipped: 'no user_id' });
      }

      // Idempotent Payment row. unique(ref) protects against duplicate webhooks.
      let paymentCreated = false;
      try {
        await prisma.payment.create({
          data: {
            userId,
            amount: plan.amountKobo,
            plan: plan.code,
            status: 'SUCCESS',
            ref,
          },
        });
        paymentCreated = true;
      } catch (err) {
        // P2002 = unique constraint violation = already processed. Safe to no-op.
        const code = (err as any)?.code;
        if (code !== 'P2002') {
          throw err;
        }
      }

      // Only update plan if this is the first time we see this payment
      if (paymentCreated) {
        await prisma.user.update({
          where: { id: userId },
          data: { plan: plan.code },
        });
      }

      console.log(`Paystack: user ${userId} upgraded to ${plan.code} (${email})`);
    }

    // Always return 200 so Paystack stops retrying. Even unknown events get 200.
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Webhook failed';
    console.error('Paystack webhook error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
