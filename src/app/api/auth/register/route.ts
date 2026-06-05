import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';
import { checkRateLimit, clientKey } from '@/lib/rate-limit';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || 'development-secret'
);

// 3 signups per 10 min per IP — bots shouldn't be mass-creating accounts.
// Legitimate users can retry in 10 min; bots give up.
const LIMIT = { max: 3, windowSec: 600 };

export async function POST(req: Request) {
  const limit = checkRateLimit(clientKey(req, 'auth:register'), LIMIT);
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many registration attempts. Try again in 10 minutes.' },
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
    const { name, email, password } = await req.json();
    if (!email || !name || !password) {
      return NextResponse.json({ error: 'Name, email, and password required' }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email, name, passwordHash, isOwner: true },
      select: { id: true, email: true, name: true, plan: true, isOwner: true, createdAt: true },
    });

    const token = await new SignJWT({ sub: user.id, email: user.email, name: user.name, plan: user.plan, isOwner: true })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(JWT_SECRET);

    const cookie = `sf_token=${token}; HttpOnly; Path=/; Max-Age=${7 * 24 * 60 * 60}; SameSite=Lax`;
    return NextResponse.json({ user }, {
      headers: { 'Set-Cookie': cookie },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 });
  }
}
