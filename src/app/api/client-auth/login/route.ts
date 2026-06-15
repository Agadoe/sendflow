import { getJWTSecret } from '@/lib/jwt';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';
import { buildAuthCookie } from '@/lib/cookie';
import { checkRateLimit, clientKey } from '@/lib/rate-limit';
import { loginSchema } from '@/lib/validation';

const LIMIT = { max: 5, windowSec: 60 };

export async function POST(req: Request) {
  const limit = checkRateLimit(clientKey(req, 'client-auth:login'), LIMIT);
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many login attempts. Try again in a minute.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(limit.resetInSec),
          'X-RateLimit-Remaining': '0',
        },
      }
    );
  }

  try {
    const body = await req.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      const message = parsed.error.errors.map(e => e.message).join('. ');
      return NextResponse.json({ error: message }, { status: 400 });
    }
    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Only CLIENT role can use this endpoint
    if (user.role !== 'CLIENT') {
      return NextResponse.json(
        { error: 'Use the admin login for admin access' },
        { status: 401 }
      );
    }

    // Gate: email must be verified before login is allowed.
    if (!user.emailVerified) {
      const reqUrl = new URL(req.url);
      const base = process.env.NEXT_PUBLIC_APP_URL || `${reqUrl.protocol}//${reqUrl.host}`;
      return NextResponse.json(
        {
          error: 'Please verify your email address before signing in.',
          needsVerification: true,
          resendUrl: `${base}/api/client-auth/resend-verify`,
        },
        { status: 403 }
      );
    }

    const token = await new SignJWT({ sub: user.id, email: user.email, name: user.name, plan: user.plan, role: user.role })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(getJWTSecret());

    const cookie = buildAuthCookie(token, 7 * 24 * 60 * 60);    return NextResponse.json(
      { ok: true, message: 'Login successful' },
      { headers: { 'Set-Cookie': cookie } }
    );
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}