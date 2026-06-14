import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { sendMail } from '@/lib/email';

const LIMIT = { max: 3, windowSec: 600 }; // 3 signups / 10 min / IP

export async function POST(req: Request) {
  // Rate limit
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
  const key = `auth:register:${ip}`;
  const { checkRateLimit } = await import('@/lib/rate-limit');
  const limit = checkRateLimit(key, LIMIT);
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many registration attempts. Try again in 10 minutes.' },
      { status: 429, headers: { 'Retry-After': String(limit.resetInSec), 'X-RateLimit-Remaining': '0' } }
    );
  }

  try {
    const { name, email, password } = await req.json();
    if (!email || !name || !password) {
      return NextResponse.json({ error: 'Name, email, and password required' }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // Create user with email NOT verified — they must click the verify link first.
    const user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
        isOwner: true,
        role: 'ADMIN',
        emailVerified: null, // Explicitly set to null to override any database defaults
      },
      select: { id: true, email: true, name: true, emailVerified: true },
    });

    // Issue a secure random token valid for 1 hour.
    const token = randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await prisma.verificationToken.create({
      data: { identifier: email, token, expires },
    });

    // Send verification email via the shared email lib (test-mode aware).
    const reqUrl = new URL(req.url);
    const base = process.env.NEXT_PUBLIC_APP_URL || `${reqUrl.protocol}//${reqUrl.host}`;
    const verifyUrl = `${base}/api/auth/verify-email?token=${encodeURIComponent(token)}`;

    const result = await sendMail({
      to: email,
      subject: 'Verify your SendFlow account',
      text: [
        `Hi ${name},`,
        ``,
        `Welcome to SendFlow! Click the link below to verify your email address.`,
        `It expires in 1 hour.`,
        ``,
        verifyUrl,
        ``,
        `If you didn't create a SendFlow account, you can ignore this email.`,
      ].join('\n'),
      html: `
        <p>Hi ${name},</p>
        <p>Welcome to SendFlow! Click the button below to verify your email address.</p>
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
          This link expires in <strong>1 hour</strong>. If you didn't create a
          SendFlow account, you can safely ignore this email.
        </p>
      `,
      testMode: true, // test mode ON by default — flip MAGIC_LINK_TEST_MODE=false to disable
    });

    if (!result.ok) {
      console.error('[register] verification email failed:', result.error, { to: email });
      // Don't expose SMTP errors to client — account was created, they can re-request verify
      return NextResponse.json(
        { error: 'Account created, but verification email failed. Contact support.' },
        { status: 502 }
      );
    }

    // 202 Accepted — account exists, verify email to activate.
    return NextResponse.json(
      {
        message: 'Account created. Check your email to verify your address.',
        deliveredTo: result.deliveredTo,
      },
      { status: 202 }
    );
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 });
  }
}