import { NextResponse } from 'next/server';
import { jwtVerify, SignJWT } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || 'development-secret'
);

export async function POST(req: Request) {
  const { email } = await req.json();
  if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 });

  // In production: send magic link email via Resend or Postmark
  // For MVP: just log the token to console
  const token = await new SignJWT({ sub: email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(JWT_SECRET);

  console.log(`[SendFlow] Magic link for ${email}: http://localhost:3000/api/auth/verify?token=${token}`);

  return NextResponse.json({ success: true, message: 'Magic link sent (check server console for MVP)' });
}
