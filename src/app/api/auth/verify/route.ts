import { NextResponse } from 'next/server';
import { jwtVerify, SignJWT } from 'jose';
import { prisma } from '@/lib/prisma';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || 'development-secret'
);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');
  if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 });

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const email = payload.sub as string;

    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.user.create({ data: { email, name: email.split('@')[0] } });
    }

    const sessionToken = await new SignJWT({ sub: user.id, email: user.email })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(JWT_SECRET);

    return NextResponse.json({ user }, {
      headers: {
        'Set-Cookie': `sf_token=${sessionToken}; HttpOnly; Path=/; Max-Age=${7 * 24 * 60 * 60}; SameSite=Lax`,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
  }
}
