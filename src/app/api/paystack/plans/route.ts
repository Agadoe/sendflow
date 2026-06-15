import { NextResponse } from 'next/server';
import { PLANS } from '@/lib/paystack';

/**
 * GET /api/paystack/plans
 * Public endpoint — returns the current plan list. No auth required.
 * Used by /subscribe page to render the pricing table.
 */
export async function GET() {
  // Don't expose amountKobo structure to the client; let the client format it.
  // But for simplicity (and since kobo is a public convention in Paystack),
  // we just return the list as-is.
  return NextResponse.json({ plans: PLANS });
}
