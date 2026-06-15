import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || 'development-secret'
);

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }

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
      .sign(JWT_SECRET);

    const cookie = `sf_token=${token}; HttpOnly; Path=/; Max-Age=${7 * 24 * 60 * 60}; SameSite=Lax`;
    return NextResponse.json(
      { ok: true, message: 'Login successful' },
      { headers: { 'Set-Cookie': cookie } }
    );
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}