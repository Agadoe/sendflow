import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';
import { checkRateLimit, clientKey } from '@/lib/rate-limit';

const JWT_SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET || 'development-secret'
);

// 5 attempts per minute per IP — slows credential-stuffing without
// inconveniencing legitimate users who mistype their password.
const LIMIT = { max: 5, windowSec: 60 };

export async function POST(req: Request) {
  const limit = checkRateLimit(clientKey(req, 'auth:login'), LIMIT);
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

    const token = await new SignJWT({ sub: user.id, email: user.email, name: user.name, plan: user.plan, role: user.role })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(JWT_SECRET);

    const cookie = `sf_token=${token}; HttpOnly; Path=/; Max-Age=${7 * 24 * 60 * 60}; SameSite=Lax`;
    return NextResponse.json(
      { user: { id: user.id, email: user.email, name: user.name, plan: user.plan, role: user.role } },
      { headers: { 'Set-Cookie': cookie } }
    );
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
