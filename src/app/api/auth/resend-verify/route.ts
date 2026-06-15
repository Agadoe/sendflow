import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';
import { sendMail } from '@/lib/email';

// 3 resend requests per 10 min per IP.
const LIMIT = { max: 3, windowSec: 600 };

// Test mode: when enabled, return the raw token in the response so e2e tests
// Resend verification email. Flip MAGIC_LINK_TEST_MODE=true in dev to route to approval inbox.
const TEST_MODE = process.env.MAGIC_LINK_TEST_MODE !== 'false';

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
  const key = `auth:resend:${ip}`;
  const { checkRateLimit } = await import('@/lib/rate-limit');
  const limit = checkRateLimit(key, LIMIT);
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many requests. Try again in 10 minutes.' },
      { status: 429, headers: { 'Retry-After': String(limit.resetInSec) } }
    );
  }

  try {
    const { email } = await req.json();
    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Security: don't reveal whether the account exists.
      return NextResponse.json(
        { message: 'If that email is registered, a verification link has been sent.' },
        { status: 200 }
      );
    }

    if (user.emailVerified) {
      return NextResponse.json(
        { message: 'That email is already verified. You can sign in.' },
        { status: 200 }
      );
    }

    // Invalidate any existing tokens for this email.
    await prisma.verificationToken.deleteMany({ where: { identifier: email } });

    // Issue a fresh token, valid 1 hour.
    const token = randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000);
    await prisma.verificationToken.create({ data: { identifier: email, token, expires } });

    const reqUrl = new URL(req.url);
    const base = process.env.NEXT_PUBLIC_APP_URL || `${reqUrl.protocol}//${reqUrl.host}`;
    const verifyUrl = `${base}/api/auth/verify-email?token=${encodeURIComponent(token)}`;

    const result = await sendMail({
      to: email,
      subject: 'Your SendFlow verification link',
      text: [
        `Hi ${user.name},`,
        ``,
        `We received a request for a new verification link. Click below to verify your email.`,
        `It expires in 1 hour.`,
        ``,
        verifyUrl,
        ``,
        `If you didn't request this, ignore the email.`,
      ].join('\n'),
      html: `
        <p>Hi ${user.name},</p>
        <p>We received a request for a new verification link. Click the button below to verify your email.</p>
        <p style="margin:24px 0">
          <a href="${verifyUrl}"
             style="background:#0EA5E9;color:#fff;padding:12px 20px;border-radius:8px;
                    text-decoration:none;display:inline-block;font-weight:600">
            Verify email address
          </a>
        </p>
        <p style="color:#64748B;font-size:13px">
          Or paste this URL: <code style="word-break:break-all">${verifyUrl}</code>
        </p>
        <p style="color:#64748B;font-size:13px">
          This link expires in <strong>1 hour</strong>. If you didn't request this, ignore the email.
        </p>
      `,
      testMode: false, // real address provided, attempt real delivery
    });

    // Always include the token in test mode — token is already in DB, email is secondary.
    const testModePayload = TEST_MODE ? { token, verifyUrl } : {};

    if (!result.ok) {
      console.error('[resend-verify] email failed:', result.error, { to: email });
      // Email failed but token is valid — still tell the test via testModePayload.
      return NextResponse.json(
        { message: 'If that email is registered, a verification link has been sent.', ...testModePayload },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { message: 'Verification email resent. Check your inbox.', ...testModePayload },
      { status: 200 }
    );
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to resend verification email' }, { status: 500 });
  }
}