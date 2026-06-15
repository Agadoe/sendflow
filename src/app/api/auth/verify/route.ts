import { NextResponse } from 'next/server';
import { jwtVerify, SignJWT } from 'jose';
import { prisma } from '@/lib/prisma';
import { getJWTSecret } from '@/lib/jwt';
import { buildAuthCookie } from '@/lib/cookie';

const ATTRIBUTION_CLAIMS = ['ref', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content'] as const;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');
  if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 });

  let email: string;
  let attribution: Record<string, string> = {};

  try {
    const { payload } = await jwtVerify(token, getJWTSecret());
    email = payload.sub as string;
    if (!email) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    // Pull attribution claims from the magic-link JWT
    for (const k of ATTRIBUTION_CLAIMS) {
      const v = payload[k];
      if (typeof v === 'string' && v) attribution[k] = v;
    }
  } catch {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
  }

  // Find or create user (idempotent — supports resend of magic-link)
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: { email, name: email.split('@')[0] },
    });
  }

  // Mark email verified (idempotent)
  if (!user.emailVerified) {
    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: new Date() },
    });
  }

  // TODO(iter 4+): persist attribution to a LeadAttribution table

  // Issue session JWT — 7 day expiry
  const sessionToken = await new SignJWT({ sub: user.id })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getJWTSecret());

  const redirectUrl = attribution.ref
    ? `/dashboard?ref=${encodeURIComponent(attribution.ref)}`
    : '/dashboard';

  return NextResponse.redirect(new URL(redirectUrl, req.url), {
    status: 302,
    headers: {
      'Set-Cookie': buildAuthCookie(sessionToken, 604800),
    },
  });
}