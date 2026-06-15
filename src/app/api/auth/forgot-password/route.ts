import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';
import { sendMail } from '@/lib/email';

const LIMIT = { max: 3, windowSec: 600 }; // 3 resets / 10 min / IP

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
  const key = `auth:forgot:${ip}`;
  const { checkRateLimit } = await import('@/lib/rate-limit');
  const limit = checkRateLimit(key, LIMIT);
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many reset attempts. Try again in 10 minutes.' },
      { status: 429, headers: { 'Retry-After': String(limit.resetInSec) } }
    );
  }

  try {
    const { email } = await req.json();
    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email address required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    // Security: don't reveal whether the account exists.
    // Silently succeed even for unknown emails — same pattern as resend-verify.
    if (!user || !user.passwordHash) {
      return NextResponse.json(
        { message: 'If that email has an account, a reset link has been sent.' },
        { status: 200 }
      );
    }

    // Invalidate any existing reset tokens for this email.
    await prisma.verificationToken.deleteMany({
      where: { identifier: `forgot:${email}` },
    });

    const token = randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await prisma.verificationToken.create({
      data: { identifier: `forgot:${email}`, token, expires },
    });

    const reqUrl = new URL(req.url);
    const base = process.env.NEXT_PUBLIC_APP_URL || `${reqUrl.protocol}//${reqUrl.host}`;
    const resetUrl = `${base}/reset-password?token=${encodeURIComponent(token)}`;

    const result = await sendMail({
      to: email,
      subject: 'Reset your SendFlow password',
      text: [
        `Hi ${user.name || email.split('@')[0]},`,
        ``,
        `We received a request to reset your SendFlow password. Click the link below to set a new password.`,
        `It expires in 1 hour.`,
        ``,
        resetUrl,
        ``,
        `If you didn't request a password reset, you can safely ignore this email — your password won't change.`,
      ].join('\n'),
      html: `
        <p>Hi ${user.name || email.split('@')[0]},</p>
        <p>We received a request to reset your SendFlow password. Click the button below to set a new password.</p>
        <p style="margin:24px 0">
          <a href="${resetUrl}"
             style="background:#0EA5E9;color:#fff;padding:12px 20px;border-radius:8px;
                    text-decoration:none;display:inline-block;font-weight:600">
            Reset password
          </a>
        </p>
        <p style="color:#64748B;font-size:13px">
          Or paste this URL: <code style="word-break:break-all">${resetUrl}</code>
        </p>
        <p style="color:#64748B;font-size:13px">
          This link expires in <strong>1 hour</strong>. If you didn't request a password reset,
          you can safely ignore this email — your password won't change.
        </p>
      `,
      testMode: false,
    });

    if (!result.ok) {
      console.error('[forgot-password] SMTP failed:', result.error, { to: email });
      return NextResponse.json(
        { message: 'If that email has an account, a reset link has been sent.' },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { message: 'If that email has an account, a reset link has been sent.' },
      { status: 200 }
    );
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to process reset request' }, { status: 500 });
  }
}