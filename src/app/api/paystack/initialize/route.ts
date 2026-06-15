import { getJWTSecret } from '@/lib/jwt';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { jwtVerify } from 'jose';
import { getPlan, initializeTransaction } from '@/lib/paystack';
import { checkRateLimit, clientKey } from '@/lib/rate-limit';


async function getUserIdFromRequest(req: NextRequest): Promise<string | null> {
  const token = req.cookies.get('sf_token')?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getJWTSecret());
    return (payload.sub as string) || null;
  } catch {
    return null;
  }
}

// 10 init attempts per 5 min per IP — generous for legitimate retries, blocks bots.
const LIMIT = { max: 10, windowSec: 300 };

/**
 * POST /api/paystack/initialize
 * Body: { plan: "STARTER" | "GROWTH" | "PRO" }
 *
 * Creates a Paystack transaction and returns the authorization URL the
 * client should redirect to. Requires an authenticated user.
 */
export async function POST(req: NextRequest) {
  const limit = checkRateLimit(clientKey(req, 'paystack:init'), LIMIT);
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many payment attempts. Try again in a few minutes.' },
      {
        status: 429,
        headers: { 'Retry-After': String(limit.resetInSec) },
      }
    );
  }

  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: 'Login required' }, { status: 401 });
    }

    const { plan: planCode } = await req.json();
    if (!planCode) {
      return NextResponse.json({ error: 'Plan code required' }, { status: 400 });
    }

    const plan = getPlan(planCode);
    if (!plan) {
      return NextResponse.json({ error: `Unknown plan: ${planCode}` }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Build callback URL. /subscribe/verify will call /api/paystack/verify/[ref]
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://sendflow-two.vercel.app';
    const callbackUrl = `${appUrl}/subscribe/verify`;

    const { data } = await initializeTransaction({
      email: user.email,
      amountKobo: plan.amountKobo,
      planCode: plan.code,
      userId,
      callbackUrl,
    });

    return NextResponse.json({
      authorizationUrl: data.authorization_url,
      reference: data.reference,
      plan: plan.code,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to initialize payment';
    console.error('Paystack init error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
