import { buildAuthCookie } from '@/lib/cookie';
import { getJWTSecret } from '@/lib/jwt';
import { NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, clientKey } from '@/lib/rate-limit';


const LIMIT = { max: 10, windowSec: 60 };

export async function GET(req: Request) {
  const limit = checkRateLimit(clientKey(req, 'auth:verify-email'), LIMIT);
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many attempts. Try again in a minute.' },
      { status: 429, headers: { 'Retry-After': String(limit.resetInSec) } }
    );
  }

  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.json({ error: 'Verification token required' }, { status: 400 });
  }

  // Look up the token — it must exist and not be expired.
  const record = await prisma.verificationToken.findUnique({ where: { token } });
  if (!record || record.expires < new Date()) {
    return NextResponse.json(
      { error: 'Invalid or expired verification link. Please request a new one.' },
      { status: 401 }
    );
  }

  const email = record.identifier;

  // Mark the user's email as verified.
  const user = await prisma.user.update({
    where: { email },
    data: { emailVerified: new Date() },
    select: { id: true, email: true, name: true, plan: true, role: true },
  });

  // Consume the token (one-time use).
  await prisma.verificationToken.delete({ where: { token } });

  // Issue a 7-day session cookie — they're now verified.
  const sessionToken = await new SignJWT({
    sub: user.id,
    email: user.email,
    name: user.name,
    plan: user.plan,
    role: user.role,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getJWTSecret());

  const base = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;

  return NextResponse.redirect(
    `${base}/dashboard?verified=true`,
    {
      status: 302,
      headers: {
        'Set-Cookie': buildAuthCookie(sessionToken, 7 * 24 * 60 * 60),
      },
    }
  );
}