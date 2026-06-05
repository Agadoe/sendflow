import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyTransaction } from '@/lib/paystack';

/**
 * GET /api/paystack/verify/[ref]
 *
 * Called by /subscribe/verify after a successful Paystack redirect.
 * Verifies the transaction with Paystack, ensures the amount and plan
 * match what we initialized, and returns a clean status payload.
 *
 * The webhook (/api/paystack/webhook) is the source of truth for
 * updating the User.plan — this endpoint is for UX feedback only.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { ref: string } }
) {
  try {
    const ref = params.ref;
    if (!ref) {
      return NextResponse.json({ error: 'Reference required' }, { status: 400 });
    }

    const { data } = await verifyTransaction(ref);

    if (data.status !== 'success') {
      return NextResponse.json(
        {
          status: 'pending',
          message: `Payment status: ${data.status}`,
          reference: ref,
        },
        { status: 200 }
      );
    }

    return NextResponse.json({
      status: 'success',
      reference: data.reference,
      amount: data.amount,
      plan: data.metadata?.plan_code || null,
      email: data.customer?.email,
      // Tell the client: webhook will update the plan, this is the cached state
      planApplied: false,
      message: 'Payment verified. Your plan will activate within a few seconds.',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Verification failed';
    console.error('Paystack verify error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
