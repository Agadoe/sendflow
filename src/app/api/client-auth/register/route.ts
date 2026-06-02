import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET || 'development-secret'
);

// Client self-registration — no auth required
export async function POST(req: Request) {
  try {
    const { name, email, password, phone } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Name, email, and password are required' }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: 'An account with this email already exists. Try logging in.' }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const client = await prisma.user.create({
      data: {
        name,
        email,
        phone: phone || null,
        plan: 'FREE', // trial plan
        role: 'CLIENT',
        passwordHash,
        isOwner: false,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        plan: true,
        createdAt: true,
      },
    });

    const token = await new SignJWT({
      sub: client.id,
      email: client.email,
      name: client.name,
      plan: 'FREE',
      role: 'CLIENT',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('30d')
      .sign(JWT_SECRET);

    const cookie = `sf_token=${token}; HttpOnly; Path=/; Max-Age=${30 * 24 * 60 * 60}; SameSite=Lax`;

    return NextResponse.json(
      {
        ok: true,
        client,
        trialMessage: 'Your 14-day trial has started. You can explore the dashboard and add your first leads. No payment required until you\'re ready.',
      },
      { headers: { 'Set-Cookie': cookie } }
    );
  } catch (err) {
    console.error('[client-register]', err);
    return NextResponse.json({ error: 'Registration failed. Please try again.' }, { status: 500 });
  }
}