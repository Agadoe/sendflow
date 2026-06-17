import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';
import { sendMail } from '@/lib/email';
import { forgotPasswordSchema } from '@/lib/validation';

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
    const body = await req.json();
    const parsed = forgotPasswordSchema.safeParse(body);
    if (!parsed.success) {
      const message = parsed.error.errors.map(e => e.message).join('. ');
      return NextResponse.json({ error: message }, { status: 400 });
    }
    const { email } = parsed.data;

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

--- auth/login ---

import { getJWTSecret } from '@/lib/jwt';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';
import { buildAuthCookie } from '@/lib/cookie';
import { checkRateLimit, clientKey } from '@/lib/rate-limit';
import { loginSchema } from '@/lib/validation';


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

    // Block login until email is verified.
    if (!user.emailVerified) {
      return NextResponse.json(
        { error: 'Please verify your email before signing in.', needsVerification: true },
        { status: 403 }
      );
    }

    const token = await new SignJWT({ sub: user.id, email: user.email, name: user.name, plan: user.plan, role: user.role })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(getJWTSecret());

    const cookie = buildAuthCookie(token, 7 * 24 * 60 * 60);    return NextResponse.json(
      { user: { id: user.id, email: user.email, name: user.name, plan: user.plan, role: user.role } },
      { headers: { 'Set-Cookie': cookie } }
    );
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}


--- auth/logout ---

import { buildAuthCookie } from '@/lib/cookie';
import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { success: true },
    {
      headers: {
        'Set-Cookie': buildAuthCookie('', 0),
      },
    }
  );
}


--- auth/magic-link ---

import { getJWTSecret } from '@/lib/jwt';
import { NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { sendMail, APPROVAL_INBOX } from '@/lib/email';
import { checkRateLimit, clientKey } from '@/lib/rate-limit';
import { forgotPasswordSchema } from '@/lib/validation';


// Allow ?ref=leadops&utm_source=... to ride through the magic-link click.
// Captured server-side so the verify route can persist attribution.
function captureAttribution(url: URL): Record<string, string> {
  const allowed = ['ref', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content'];
  const out: Record<string, string> = {};
  for (const k of allowed) {
    const v = url.searchParams.get(k);
    if (v) out[k] = v;
  }
  return out;
}

const LIMIT = { max: 3, windowSec: 60 };

export async function POST(req: Request) {
  const limit = checkRateLimit(clientKey(req, 'auth:magic-link'), LIMIT);
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many attempts. Try again in a minute.' },
      { status: 429, headers: { 'Retry-After': String(limit.resetInSec) } }
    );
  }

  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = forgotPasswordSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.errors.map(e => e.message).join('. ');
    return NextResponse.json({ error: message }, { status: 400 });
  }
  const email = parsed.data.email.trim().toLowerCase();

  // Test mode forces delivery to the approval inbox. Default ON until the
  // email-verification flow is signed off by Don — flip via env when ready.
  const testMode = process.env.MAGIC_LINK_TEST_MODE === 'true'; // default false in production

  // Capture attribution from the request URL (e.g. ?ref=leadops&utm_campaign=...)
  const reqUrl = new URL(req.url);
  const attribution = captureAttribution(reqUrl);

  // Sign a 15-minute token with the email + attribution claims.
  const token = await new SignJWT({ sub: email, ...attribution })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(getJWTSecret());

  const base = process.env.NEXT_PUBLIC_APP_URL || `${reqUrl.protocol}//${reqUrl.host}`;
  const verifyUrl = `${base}/api/auth/verify?token=${encodeURIComponent(token)}`;

  const subject = 'Your SendFlow sign-in link';
  const text = [
    `Hi,`,
    ``,
    `Click the link below to sign in to SendFlow. It expires in 15 minutes.`,
    ``,
    verifyUrl,
    ``,
    `If you didn't request this, you can ignore the email.`,
  ].join('\n');
  const html = `
    <p>Hi,</p>
    <p>Click the button below to sign in to SendFlow. The link expires in 15 minutes.</p>
    <p style="margin:24px 0">
      <a href="${verifyUrl}"
         style="background:#0EA5E9;color:#fff;padding:12px 20px;border-radius:8px;
                text-decoration:none;display:inline-block;font-weight:600">
        Sign in to SendFlow
      </a>
    </p>
    <p style="color:#64748B;font-size:13px">
      Or paste this URL: <br>
      <code style="word-break:break-all">${verifyUrl}</code>
    </p>
    <p style="color:#64748B;font-size:13px">If you didn't request this, you can ignore the email.</p>
  `;

  const result = await sendMail({
    to: email,
    subject,
    text,
    html,
    testMode,
  });

  if (!result.ok) {
    console.error('[magic-link] SMTP failed:', result.error, { to: email, testMode });
    // Don't leak SMTP error to the client, but don't pretend success either.
    return NextResponse.json(
      { success: false, error: 'Failed to send email. Try again in a moment.' },
      { status: 502 }
    );
  }

  return NextResponse.json({
    success: true,
    // In test mode, surface where the email actually went so Don can verify.
    deliveredTo: result.deliveredTo,
    ...(testMode ? { note: `Test mode ON — email routed to ${APPROVAL_INBOX}` } : {}),
  });
}


--- auth/me ---

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

export async function GET(req: Request) {
  const session = await getSession(req as NextRequest);
  if (!session) {
    return NextResponse.json({ user: null }, { status: 401 });
  }
  // Return full session including role and isOwner
  return NextResponse.json({
    user: {
      id: session.id,
      email: session.email,
      name: session.name,
      plan: session.plan,
      role: session.role,
      isOwner: session.isOwner,
    },
  });
}


--- auth/register ---

import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { sendMail } from '@/lib/email';
import { registerSchema } from '@/lib/validation';

const LIMIT = { max: 10, windowSec: 600 }; // 10 signups / 10 min / IP

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
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      const message = parsed.error.errors.map(e => e.message).join('. ');
      return NextResponse.json({ error: message }, { status: 400 });
    }
    const { name, email, password, attribution } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // Capture UTM/referral params if provided
    const utmSource = attribution?.source || null;
    const utmMedium = attribution?.medium || null;
    const utmCampaign = attribution?.campaign || null;
    const ref = attribution?.ref || null;

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

    // Persist attribution data if any params were captured
    if (utmSource || utmMedium || utmCampaign || ref) {
      await prisma.leadAttribution.create({
        data: {
          userId: user.id,
          source: utmSource,
          medium: utmMedium,
          campaign: utmCampaign,
          ref,
          landingUrl: attribution?.landingUrl || null,
        },
      });
    }

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
      testMode: false, // production — real emails sent to real addresses
    });

    if (!result.ok) {
      console.error('[register] verification email failed:', result.error, { to: email });
      // Account was created — still return 202 so the client can proceed.
      // The user can re-request verification email from the login screen.
      return NextResponse.json(
        {
          message: 'Account created. Check your email to verify your address.',
          deliveredTo: result.deliveredTo,
          emailWarning: 'Verification email could not be sent. Use "Resend" on the login screen.',
        },
        { status: 202 }
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

--- auth/resend-verify ---

import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';
import { sendMail } from '@/lib/email';

// 10 resend requests per 10 min per IP.
const LIMIT = { max: 10, windowSec: 600 };

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

--- auth/reset-password ---

import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { resetPasswordSchema } from '@/lib/validation';
import { checkRateLimit, clientKey } from '@/lib/rate-limit';

const LIMIT = { max: 5, windowSec: 60 };

export async function POST(req: Request) {
  const limit = checkRateLimit(clientKey(req, 'auth:reset-password'), LIMIT);
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many attempts. Try again in a minute.' },
      { status: 429, headers: { 'Retry-After': String(limit.resetInSec) } }
    );
  }

  try {
    const body = await req.json();
    const parsed = resetPasswordSchema.safeParse(body);
    if (!parsed.success) {
      const message = parsed.error.errors.map(e => e.message).join('. ');
      return NextResponse.json({ error: message }, { status: 400 });
    }
    const { token, password } = parsed.data;

    // Find the token — it must exist and not be expired.
    // identifier format: forgot:${email}
    const record = await prisma.verificationToken.findUnique({
      where: { token },
    });

    if (!record) {
      return NextResponse.json({ error: 'Invalid reset token' }, { status: 401 });
    }
    if (record.expires < new Date()) {
      return NextResponse.json({ error: 'Reset token has expired. Request a new one.' }, { status: 401 });
    }

    // Extract email from identifier (format: forgot:email@example.com)
    const email = record.identifier.replace(/^forgot:/, '');
    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Invalid token format' }, { status: 401 });
    }

    // Hash the new password and update the user.
    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.update({
      where: { email },
      data: { passwordHash },
    });

    // Consume the token so it can't be reused.
    await prisma.verificationToken.delete({ where: { token } });

    return NextResponse.json(
      { message: 'Password updated. You can now sign in with your new password.' },
      { status: 200 }
    );
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to reset password' }, { status: 500 });
  }
}

--- auth/verify-email ---

import { buildAuthCookie } from '@/lib/cookie';
import { getJWTSecret } from '@/lib/jwt';
import { NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, clientKey } from '@/lib/rate-limit';


const LIMIT = { max: 10, windowSec: 60 };

export async function GET(req: Request) {
  const limit = checkRateLimit(clientKey(req, 'auth:verify-email'), LIMIT);
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many attempts. Try again in a minute.' },
      { status: 429, headers: { 'Retry-After': String(limit.resetInSec) } }
    );
  }

  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.json({ error: 'Verification token required' }, { status: 400 });
  }

  // Look up the token — it must exist and not be expired.
  const record = await prisma.verificationToken.findUnique({ where: { token } });
  if (!record || record.expires < new Date()) {
    return NextResponse.json(
      { error: 'Invalid or expired verification link. Please request a new one.' },
      { status: 401 }
    );
  }

  const email = record.identifier;

  // Mark the user's email as verified.
  const user = await prisma.user.update({
    where: { email },
    data: { emailVerified: new Date() },
    select: { id: true, email: true, name: true, plan: true, role: true },
  });

  // Consume the token (one-time use).
  await prisma.verificationToken.delete({ where: { token } });

  // Issue a 7-day session cookie — they're now verified.
  const sessionToken = await new SignJWT({
    sub: user.id,
    email: user.email,
    name: user.name,
    plan: user.plan,
    role: user.role,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getJWTSecret());

  const base = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;

  return NextResponse.redirect(
    `${base}/dashboard?verified=true`,
    {
      status: 302,
      headers: {
        'Set-Cookie': buildAuthCookie(sessionToken, 7 * 24 * 60 * 60),
      },
    }
  );
}

--- auth/verify ---

import { NextResponse } from 'next/server';
import { jwtVerify, SignJWT } from 'jose';
import { prisma } from '@/lib/prisma';
import { getJWTSecret } from '@/lib/jwt';
import { buildAuthCookie } from '@/lib/cookie';

const ATTRIBUTION_CLAIMS = ['ref', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content'] as const;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');
  if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 });

  let email: string;
  let attribution: Record<string, string> = {};

  try {
    const { payload } = await jwtVerify(token, getJWTSecret());
    email = payload.sub as string;
    if (!email) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    // Pull attribution claims from the magic-link JWT
    for (const k of ATTRIBUTION_CLAIMS) {
      const v = payload[k];
      if (typeof v === 'string' && v) attribution[k] = v;
    }
  } catch {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
  }

  // Find or create user (idempotent — supports resend of magic-link)
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: { email, name: email.split('@')[0] },
    });
  }

  // Mark email verified (idempotent)
  if (!user.emailVerified) {
    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: new Date() },
    });
  }

  // TODO(iter 4+): persist attribution to a LeadAttribution table

  // Issue session JWT — 7 day expiry
  const sessionToken = await new SignJWT({ sub: user.id })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getJWTSecret());

  const redirectUrl = attribution.ref
    ? `/dashboard?ref=${encodeURIComponent(attribution.ref)}`
    : '/dashboard';

  return NextResponse.redirect(new URL(redirectUrl, req.url), {
    status: 302,
    headers: {
      'Set-Cookie': buildAuthCookie(sessionToken, 604800),
    },
  });
}

--- client-auth/login ---

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

--- client-auth/register ---

import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { sendMail } from '@/lib/email';
import { clientRegisterSchema } from '@/lib/validation';

const LIMIT = { max: 3, windowSec: 600 }; // 3 signups / 10 min / IP

export async function POST(req: Request) {
  // Rate limit
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
  const key = `client-auth:register:${ip}`;
  const { checkRateLimit } = await import('@/lib/rate-limit');
  const limit = checkRateLimit(key, LIMIT);
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many registration attempts. Try again in 10 minutes.' },
      { status: 429, headers: { 'Retry-After': String(limit.resetInSec), 'X-RateLimit-Remaining': '0' } }
    );
  }

  try {
    const body = await req.json();
    const parsed = clientRegisterSchema.safeParse(body);
    if (!parsed.success) {
      const message = parsed.error.errors.map(e => e.message).join('. ');
      return NextResponse.json({ error: message }, { status: 400 });
    }
    const { name, email, password, phone } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: 'An account with this email already exists. Try logging in.' }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // Create user with email NOT verified — they must click the verify link first.
    const client = await prisma.user.create({
      data: {
        name,
        email,
        phone: phone || null,
        plan: 'FREE',
        role: 'CLIENT',
        passwordHash,
        isOwner: false,
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
    const verifyUrl = `${base}/api/client-auth/verify-email?token=${encodeURIComponent(token)}`;

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
      testMode: process.env.EMAIL_TEST_MODE === 'true', // set EMAIL_TEST_MODE=true in dev only
    });

    if (!result.ok) {
      console.error('[client-auth/register] verification email failed:', result.error, { to: email });
      // Don't expose SMTP errors to client — account was created, they can re-request verify
      return NextResponse.json(
        { error: 'Account created, but verification email failed. Contact support.' },
        { status: 502 }
      );
    }

    // 202 Accepted — account exists, verify email to activate. NO session cookie.
    return NextResponse.json(
      {
        message: 'Account created. Check your email to verify your address.',
        deliveredTo: result.deliveredTo,
      },
      { status: 202 }
    );
  } catch (err) {
    console.error('[client-auth/register]', err);
    return NextResponse.json({ error: 'Registration failed. Please try again.' }, { status: 500 });
  }
}

--- client-auth/resend-verify ---

import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';
import { sendMail } from '@/lib/email';

// 3 resend requests per 10 min per IP.
const LIMIT = { max: 3, windowSec: 600 };

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
  const key = `client-auth:resend:${ip}`;
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
    const verifyUrl = `${base}/api/client-auth/verify-email?token=${encodeURIComponent(token)}`;

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
      testMode: process.env.EMAIL_TEST_MODE === 'true', // set EMAIL_TEST_MODE=true in dev only
    });

    if (!result.ok) {
      console.error('[client-auth/resend-verify] SMTP failed:', result.error, { to: email });
      return NextResponse.json(
        { message: 'If that email is registered, a verification link has been sent.' },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { message: 'Verification email resent. Check your inbox.' },
      { status: 200 }
    );
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to resend verification email' }, { status: 500 });
  }
}

--- client-auth/verify-email ---

import { buildAuthCookie } from '@/lib/cookie';
import { getJWTSecret } from '@/lib/jwt';
import { NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, clientKey } from '@/lib/rate-limit';


const LIMIT = { max: 10, windowSec: 60 };

export async function GET(req: Request) {
  const limit = checkRateLimit(clientKey(req, 'client-auth:verify-email'), LIMIT);
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many attempts. Try again in a minute.' },
      { status: 429, headers: { 'Retry-After': String(limit.resetInSec) } }
    );
  }

  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.json({ error: 'Verification token required' }, { status: 400 });
  }

  // Look up the token — it must exist and not be expired.
  const record = await prisma.verificationToken.findUnique({ where: { token } });
  if (!record || record.expires < new Date()) {
    return NextResponse.json(
      { error: 'Invalid or expired verification link. Please request a new one.' },
      { status: 401 }
    );
  }

  const email = record.identifier;

  // Mark the user's email as verified.
  const user = await prisma.user.update({
    where: { email },
    data: { emailVerified: new Date() },
    select: { id: true, email: true, name: true, plan: true, role: true },
  });

  // Consume the token (one-time use).
  await prisma.verificationToken.delete({ where: { token } });

  // Issue a 7-day session cookie — they're now verified.
  const sessionToken = await new SignJWT({
    sub: user.id,
    email: user.email,
    name: user.name,
    plan: user.plan,
    role: user.role,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getJWTSecret());

  const base = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;

  return NextResponse.redirect(
    `${base}/client-portal?verified=true`,
    {
      status: 302,
      headers: {
        'Set-Cookie': buildAuthCookie(sessionToken, 7 * 24 * 60 * 60),
      },
    }
  );
}

--- contacts/[id] ---

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const cookieHeader = req.headers.get('cookie');
  const userId = cookieHeader ? cookieHeader.match(/sf_token=([^;]+)/)?.[1] : null;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  try {
    await prisma.contact.deleteMany({ where: { id, userId } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }
}

--- forms/[id]/submit ---

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { phone, answers } = body;

  if (!phone) {
    return NextResponse.json({ error: 'phone required' }, { status: 400 });
  }

  const form = await prisma.whatsAppForm.findUnique({ where: { id } });
  if (!form || !form.isActive) {
    return NextResponse.json({ error: 'Form not found or inactive' }, { status: 404 });
  }

  const cleanPhone = phone.replace(/\D/g, '');

  // Save submission
  const submission = await prisma.whatsAppFormSubmission.create({
    data: {
      formId: id,
      phone: cleanPhone,
      answers: JSON.stringify(answers || {}),
    },
  });

  // Save as contact (upsert)
  let contact = await prisma.contact.findFirst({
    where: { userId: form.userId, phone: cleanPhone },
  });

  const contactData: any = { phone: cleanPhone };
  let tags: string[] = [];
  if (contact) {
    try { tags = JSON.parse(contact.tags || '[]'); } catch {}
  }
  if (form.tagName && form.tagValue) {
    if (!tags.includes(form.tagValue)) tags.push(form.tagValue);
    contactData.tags = JSON.stringify(tags);
  }

  if (contact) {
    await prisma.contact.update({ where: { id: contact.id }, data: contactData });
  } else {
    contact = await prisma.contact.create({
      data: { userId: form.userId, phone: cleanPhone, tags: contactData.tags || '[]' },
    });
  }

  // Build WhatsApp link to open chat
  const base = `https://wa.me/${cleanPhone}`;
  const encoded = encodeURIComponent(form.prefillMsg || '');
  const waUrl = encoded ? `${base}?text=${encoded}` : base;

  return NextResponse.json({ success: true, submission, contact, waUrl });
}

--- wacli/connect ---

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import https from 'https';
import http from 'http';

const DAEMON_URL = process.env.WACLI_DAEMON_URL || 'http://84.8.221.131';

function fetchDaemon(
  path: string,
  options: { method?: string; headers?: http.OutgoingHttpHeaders; body?: string } = {}
): Promise<{ ok: boolean; status: number; json: () => Promise<any> }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, DAEMON_URL);
    const client = url.protocol === 'https:' ? https : http;
    const req = client.request(
      {
        hostname: url.hostname,
        port: url.port || undefined,
        path: url.pathname + url.search,
        method: options.method || 'GET',
        headers: options.headers,
        rejectUnauthorized: false,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          resolve({
            ok: !!(res.statusCode && res.statusCode >= 200 && res.statusCode < 300),
            status: res.statusCode || 0,
            json: () => Promise.resolve(JSON.parse(data)),
          });
        });
      }
    );
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

// POST /connect → regenerate QR and reconnect
export async function POST() {
  try {
    // Get the current user
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const res = await fetchDaemon('/wacli/connect', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': user.id
      },
      body: JSON.stringify({})
    });

    const data = await res.json();
    if (!res.ok) return NextResponse.json(data, { status: res.status });

    // Map daemon status to app state. The daemon returns status values like:
    // 'already_connected', 'connecting', 'waiting', 'error', etc.
    // Do NOT assume QR_READY — the QR isn't generated until 3–8s after init.
    const daemonStatus = data.status || data.state;
    let appState: string;
    if (daemonStatus === 'already_connected' || daemonStatus === 'CONNECTED') {
      appState = 'CONNECTED';
    } else if (daemonStatus === 'connecting' || daemonStatus === 'RECONNECTING') {
      appState = 'CONNECTING';
    } else {
      appState = 'CONNECTING'; // QR not ready yet — UI should poll
    }

    // Update user's wacli status
    await prisma.user.update({
      where: { id: user.id },
      data: {
        wacliStatus: appState
      }
    });

    return NextResponse.json({ success: true, state: appState });
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to reconnect: ' + e.message }, { status: 500 });
  }
}

// GET /connect → get current QR
export async function GET() {
  try {
    // Get the current user
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const res = await fetchDaemon('/wacli/qr', {
      headers: {
        'X-User-Id': user.id
      }
    });

    const data = await res.json();
    if (!res.ok) return NextResponse.json(data, { status: res.status });

    // Exhaustive state mapping — prevents CONNECTING being overwritten by DISCONNECTED
    const daemonStatus = data.status || data.state;
    const qr = data.qr || null;
    let appState: string;
    if (daemonStatus === 'already_connected' || daemonStatus === 'CONNECTED') {
      appState = 'CONNECTED';
    } else if (qr) {
      appState = 'QR_READY';
    } else if (daemonStatus === 'waiting' || daemonStatus === 'connecting' || daemonStatus === 'INITIALIZING' || daemonStatus === 'STARTING' || daemonStatus === 'RECONNECTING') {
      appState = 'CONNECTING';
    } else {
      appState = 'DISCONNECTED';
    }

    // Update user's QR code and status
    await prisma.user.update({
      where: { id: user.id },
      data: {
        wacliQrCode: qr,
        wacliStatus: appState
      }
    });

    return NextResponse.json({ qr, state: appState, success: true });
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to get QR: ' + e.message }, { status: 500 });
  }
}


--- wacli/disconnect ---

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import https from 'https';
import http from 'http';

const DAEMON_URL = process.env.WACLI_DAEMON_URL || 'http://84.8.221.131';

function fetchDaemon(
  path: string,
  options: { method?: string; headers?: http.OutgoingHttpHeaders; body?: string } = {}
): Promise<{ ok: boolean; status: number; json: () => Promise<any> }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, DAEMON_URL);
    const client = url.protocol === 'https:' ? https : http;
    const req = client.request(
      {
        hostname: url.hostname,
        port: url.port || undefined,
        path: url.pathname + url.search,
        method: options.method || 'GET',
        headers: options.headers,
        rejectUnauthorized: false,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          resolve({
            ok: !!(res.statusCode && res.statusCode >= 200 && res.statusCode < 300),
            status: res.statusCode || 0,
            json: () => Promise.resolve(JSON.parse(data)),
          });
        });
      }
    );
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

// POST /disconnect → destroy WhatsApp session via daemon
export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const res = await fetchDaemon('/wacli/disconnect', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': user.id
      },
      body: JSON.stringify({})
    });
    const data = await res.json();
    if (!res.ok) return NextResponse.json(data, { status: res.status });

    await prisma.user.update({
      where: { id: user.id },
      data: {
        wacliStatus: 'DISCONNECTED',
        wacliQrCode: null,
        wacliPhone: null,
        wacliLastConnectedAt: null,
      }
    });

    return NextResponse.json({ success: true, state: 'DISCONNECTED' });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}


--- wacli/send ---

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import https from 'https';
import http from 'http';

const DAEMON_URL = process.env.WACLI_DAEMON_URL || 'http://84.8.221.131';

function fetchDaemon(
  path: string,
  options: { method?: string; headers?: http.OutgoingHttpHeaders; body?: string } = {}
): Promise<{ ok: boolean; status: number; json: () => Promise<any> }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, DAEMON_URL);
    const client = url.protocol === 'https:' ? https : http;
    const req = client.request(
      {
        hostname: url.hostname,
        port: url.port || undefined,
        path: url.pathname + url.search,
        method: options.method || 'GET',
        headers: options.headers,
        rejectUnauthorized: false,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          resolve({
            ok: !!(res.statusCode && res.statusCode >= 200 && res.statusCode < 300),
            status: res.statusCode || 0,
            json: () => Promise.resolve(JSON.parse(data)),
          });
        });
      }
    );
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

function formatPhone(phone: string): string {
  const clean = (phone || '').replace(/\D/g, '');
  if (clean.startsWith('0')) return `+233${clean.slice(1)}`;
  if (clean.startsWith('233')) return `+${clean}`;
  return `+233${clean}`;
}

export async function POST(req: Request) {
  try {
    // Get the current user
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { phone, message } = await req.json();

    if (!phone || !message) {
      return NextResponse.json({ error: 'phone and message required' }, { status: 400 });
    }

    const formatted = formatPhone(phone);
    const body = JSON.stringify({ phone: formatted, message });

    const res = await fetchDaemon('/wacli/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': user.id
      },
      body,
    });

    const data = await res.json();
    if (!res.ok) return NextResponse.json(data, { status: res.status });

    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}


--- wacli/status ---

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import https from 'https';
import http from 'http';

const DAEMON_URL = process.env.WACLI_DAEMON_URL || 'http://84.8.221.131';

function fetchDaemon(
  path: string,
  options: { method?: string; headers?: http.OutgoingHttpHeaders; body?: string } = {}
): Promise<{ ok: boolean; status: number; json: () => Promise<any> }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, DAEMON_URL);
    const client = url.protocol === 'https:' ? https : http;
    const req = client.request(
      {
        hostname: url.hostname,
        port: url.port || undefined,
        path: url.pathname + url.search,
        method: options.method || 'GET',
        headers: options.headers,
        rejectUnauthorized: false,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          resolve({
            ok: !!(res.statusCode && res.statusCode >= 200 && res.statusCode < 300),
            status: res.statusCode || 0,
            json: () => Promise.resolve(JSON.parse(data)),
          });
        });
      }
    );
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

export async function GET() {
  try {
    // Get the current user
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch status from the daemon (uses /health which returns { connection })
    const res = await fetchDaemon('/wacli/health', {
      headers: {
        'X-User-Id': user.id
      }
    });

    if (!res.ok) {
      // Daemon error — WhatsApp might be down or starting
      return NextResponse.json({ connected: false, state: 'daemon_error', detail: `HTTP ${res.status}` });
    }

    const data = await res.json();

    // Exhaustive state mapping from daemon → app
    const daemonStatus = data.status || data.state || data.connection;
    let appState: string;
    if (data.connected === true || daemonStatus === 'CONNECTED' || daemonStatus === 'open') {
      appState = 'CONNECTED';
    } else if (daemonStatus === 'QR_READY') {
      appState = 'QR_READY';
    } else if (daemonStatus === 'connecting' || daemonStatus === 'waiting' || daemonStatus === 'INITIALIZING' || daemonStatus === 'STARTING' || daemonStatus === 'RECONNECTING') {
      appState = 'CONNECTING';
    } else {
      appState = daemonStatus || 'DISCONNECTED';
    }

    // Only write to DB if state actually changed — prevents hammering the DB
    // every 2 seconds while polling
    const currentUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { wacliStatus: true, wacliPhone: true }
    });

    const phone = data.phone || data.info?.pushName || null;
    const stateChanged = currentUser?.wacliStatus !== appState;
    const phoneChanged = currentUser?.wacliPhone !== phone;

    if (stateChanged || phoneChanged) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          wacliStatus: appState,
          wacliPhone: phone,
          ...(data.connected ? { wacliLastConnectedAt: new Date() } : {})
        }
      });
    }

    // Return unified shape to the client
    return NextResponse.json({
      connected: appState === 'CONNECTED',
      state: appState,
      phone: phone,
      info: data.info || null
    });
  } catch (error) {
    console.error('Error fetching wacli status:', error);
    // Fetch failed entirely — daemon is not reachable
    return NextResponse.json({ connected: false, state: 'unreachable' });
  }
}


--- drip/route ---

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function getUserIdFromCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/sf_token=([^;]+)/);
  if (!match) return null;
  try {
    const payload = JSON.parse(Buffer.from(match[1].split('.')[1], 'base64').toString());
    return payload.sub || null;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const cookieHeader = req.headers.get('cookie');
  const userId = getUserIdFromCookie(cookieHeader);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') || 'PENDING';

  const messages = await prisma.dripScheduledMessage.findMany({
    where: { userId, status: status.toUpperCase() },
    orderBy: { scheduledFor: 'asc' },
    take: 100,
    include: {
      contact: { select: { name: true, phone: true } },
      automation: { select: { name: true } },
    },
  });

  return NextResponse.json({ messages });
}

--- drip/[id] ---

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function getUserIdFromCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/sf_token=([^;]+)/);
  if (!match) return null;
  try {
    const payload = JSON.parse(Buffer.from(match[1].split('.')[1], 'base64').toString());
    return payload.sub || null;
  } catch {
    return null;
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const cookieHeader = req.headers.get('cookie');
  const userId = getUserIdFromCookie(cookieHeader);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const existing = await prisma.dripScheduledMessage.findFirst({ where: { id, userId } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (existing.status !== 'PENDING') {
    return NextResponse.json({ error: 'Can only cancel pending messages' }, { status: 400 });
  }

  await prisma.dripScheduledMessage.update({
    where: { id },
    data: { status: 'CANCELLED' },
  });

  return NextResponse.json({ success: true });
}

--- lead-push ---

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createHash } from 'crypto';
import { randomBytes } from 'crypto';

const KEY_CACHE = new Map<string, string>(); // hash -> userId

function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

async function validateKey(rawKey: string): Promise<string | null> {
  if (!rawKey) return null;
  const h = hashKey(rawKey);
  const cached = KEY_CACHE.get(h);
  if (cached) return cached;

  const dbKey = await prisma.apiKey.findFirst({
    where: { key: rawKey },
    select: { userId: true },
  });
  if (!dbKey) return null;

  KEY_CACHE.set(h, dbKey.userId);
  return dbKey.userId;
}

// POST /api/leads/ingest — batch create leads from LEADOPS agents
// Auth: X-SENDFLOW-KEY header
export async function POST(req: NextRequest) {
  const rawKey = req.headers.get('x-sendflow-key') || '';
  const userId = await validateKey(rawKey);
  if (!userId) {
    return NextResponse.json({ error: 'Invalid or missing API key' }, { status: 401 });
  }

  try {
    const { leads } = await req.json();
    if (!Array.isArray(leads) || leads.length === 0) {
      return NextResponse.json({ error: 'leads array required' }, { status: 400 });
    }

    if (leads.length > 500) {
      return NextResponse.json({ error: 'Max 500 leads per batch' }, { status: 400 });
    }

    const results = { created: 0, skipped: 0, errors: [] as string[] };

    for (const lead of leads) {
      try {
        if (!lead.name && !lead.email && !lead.phone) {
          results.skipped++;
          continue;
        }

        // Upsert by email if provided
        if (lead.email) {
          const existing = await prisma.lead.findFirst({
            where: { userId, email: lead.email },
          });
          if (existing) {
            // Update stage if provided
            if (lead.stage) {
              await prisma.lead.update({
                where: { id: existing.id },
                data: { stage: lead.stage, updatedAt: new Date() },
              });
            }
            results.skipped++;
            continue;
          }
        }

        const newLead = await prisma.lead.create({
          data: {
            userId,
            name: lead.name || 'Unknown',
            email: lead.email || null,
            phone: lead.phone || null,
            company: lead.company || null,
            stage: lead.stage || 'NEW',
            source: lead.source || 'LEADOPS',
            notes: lead.notes || '',
            nextFollowUp: lead.nextFollowUp ? new Date(lead.nextFollowUp) : null,
          },
        });

        if (lead.notes || lead.activity) {
          await prisma.leadActivity.create({
            data: {
              leadId: newLead.id,
              userId,
              type: 'note',
              content: lead.activity || `Lead ingested via LEADOPS — source: ${lead.source || 'unknown'}`,
            },
          });
        }

        results.created++;
      } catch (err) {
        results.errors.push(`Failed to create lead ${lead.email || lead.phone}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    // Update lastUsed on the API key
    await prisma.apiKey.updateMany({
      where: { key: rawKey },
      data: { lastUsed: new Date() },
    });

    return NextResponse.json({
      success: true,
      results,
      ingestedAt: new Date().toISOString(),
    }, { status: 201 });

  } catch (err) {
    console.error('Lead ingest error:', err);
    return NextResponse.json({ error: 'Batch ingest failed' }, { status: 500 });
  }
}

// GET /api/lead-push — check API key validity and account info
export async function GET(req: NextRequest) {
  const rawKey = req.headers.get('x-sendflow-key') || '';
  const userId = await validateKey(rawKey);
  if (!userId) {
    return NextResponse.json({ error: 'Invalid or missing API key' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, plan: true },
  });

  const leadCount = await prisma.lead.count({ where: { userId } });

  return NextResponse.json({
    status: 'ok',
    user,
    leadCount,
  });
}

--- kgc-contact ---

import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: 'mail.baahe.org',
  port: 465,
  secure: true, // port 465 = SMTPS (TLS on connect)
  auth: {
    user: process.env.SMTP_USER || 'sendflow@baahe.org',
    pass: process.env.SMTP_PASS || '',
  },
  tls: {
    rejectUnauthorized: true,
  },
});

export async function POST(req: Request) {
  try {
    const { name, email, company, phone, plan, message } = await req.json();

    if (!name || !email) {
      return NextResponse.json({ error: 'Name and email required' }, { status: 400 });
    }

    const subject = `KGC Lead: ${name}${company ? ` from ${company}` : ''}`;
    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #0A0A0A; color: #F5F2EC; padding: 32px 40px; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">
            KGC<span style="color: #C8922A;">.</span> — New Contact Form Lead
          </h1>
          <p style="margin: 8px 0 0; font-size: 13px; color: rgba(245,242,236,0.45);">Kaizen Global Consult</p>
        </div>
        <div style="background: #F5F2EC; padding: 32px 40px; border-radius: 0 0 8px 8px; border: 1px solid #D8D4CC;">
          <table style="width: 100%; border-collapse: collapse;">
            ${company ? `<tr><td style="padding: 8px 0; border-bottom: 1px solid #D8D4CC; font-size: 12px; color: #6B6B6B; letter-spacing: 0.5px; text-transform: uppercase;">Company</td><td style="padding: 8px 0; border-bottom: 1px solid #D8D4CC; font-size: 15px; font-weight: 600; color: #0A0A0A;">${company}</td></tr>` : ''}
            <tr><td style="padding: 8px 0; border-bottom: 1px solid #D8D4CC; font-size: 12px; color: #6B6B6B; letter-spacing: 0.5px; text-transform: uppercase;">Name</td><td style="padding: 8px 0; border-bottom: 1px solid #D8D4CC; font-size: 15px; font-weight: 600; color: #0A0A0A;">${name}</td></tr>
            <tr><td style="padding: 8px 0; border-bottom: 1px solid #D8D4CC; font-size: 12px; color: #6B6B6B; letter-spacing: 0.5px; text-transform: uppercase;">Email</td><td style="padding: 8px 0; border-bottom: 1px solid #D8D4CC; font-size: 15px; color: #0A0A0A;"><a href="mailto:${email}" style="color: #C8922A;">${email}</a></td></tr>
            ${phone ? `<tr><td style="padding: 8px 0; border-bottom: 1px solid #D8D4CC; font-size: 12px; color: #6B6B6B; letter-spacing: 0.5px; text-transform: uppercase;">Phone</td><td style="padding: 8px 0; border-bottom: 1px solid #D8D4CC; font-size: 15px; color: #0A0A0A;">${phone}</td></tr>` : ''}
            ${plan ? `<tr><td style="padding: 8px 0; border-bottom: 1px solid #D8D4CC; font-size: 12px; color: #6B6B6B; letter-spacing: 0.5px; text-transform: uppercase;">Plan Interest</td><td style="padding: 8px 0; border-bottom: 1px solid #D8D4CC; font-size: 15px; color: #C8922A; font-weight: 600;">${plan}</td></tr>` : ''}
            ${message ? `<tr><td style="padding: 12px 0 4px; font-size: 12px; color: #6B6B6B; letter-spacing: 0.5px; text-transform: uppercase;">Message</td></tr><tr><td colspan="2" style="padding: 4px 0 12px; font-size: 14px; color: #0A0A0A; line-height: 1.6;">${message}</td></tr>` : ''}
          </table>
          <p style="font-size: 11px; color: #6B6B6B; margin-top: 24px; border-top: 1px solid #D8D4CC; padding-top: 16px;">
            Received: ${new Date().toLocaleString('en-GB', { timeZone: 'Africa/Accra' })} GMT
          </p>
        </div>
      </div>
    `;

    try {
      await transporter.sendMail({
        from: `"KGC Website" <kaizenglobalconsult@gmail.com>`,
        to: 'Kaizensalesconsult@gmail.com',
        replyTo: email,
        subject,
        html: htmlBody,
      });
    } catch (mailErr) {
      // SMTP not configured — log and continue
      console.log('[kgc-contact] SMTP send failed, logging instead:', mailErr);
    }

    console.log('━━━ KGC CONTACT FORM ━━━');
    console.log('Name:', name, '| Email:', email, '| Company:', company, '| Phone:', phone, '| Plan:', plan);
    console.log('Message:', message);
    console.log('Time:', new Date().toISOString());

    return NextResponse.json({ ok: true, message: 'We will be in touch within 24 hours.' });
  } catch (err) {
    console.error('[kgc-contact] Error:', err);
    return NextResponse.json({ error: 'Submission failed. Please try again.' }, { status: 500 });
  }
}

--- analytics ---

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function getUserIdFromCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/sf_token=([^;]+)/);
  if (!match) return null;
  try {
    const payload = JSON.parse(Buffer.from(match[1].split('.')[1], 'base64').toString());
    return payload.sub || null;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const cookieHeader = req.headers.get('cookie');
  const userId = getUserIdFromCookie(cookieHeader);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const campaigns = await prisma.campaign.findMany({
    where: { userId },
    include: { _count: { select: { messages: true } }, messages: true },
  });

  const total = campaigns.reduce((acc, c) => acc + (c._count?.messages || 0), 0);
  const delivered = campaigns.reduce((acc, c) => acc + c.messages.filter((m: any) => m.status === 'DELIVERED').length, 0);
  const failed = campaigns.reduce((acc, c) => acc + c.messages.filter((m: any) => m.status === 'FAILED').length, 0);

  const stats = {
    total,
    delivered,
    failed,
    rate: total > 0 ? Math.round((delivered / total) * 100) : 0,
  };

  const campaignStats = campaigns.map((c: any) => {
    const sent = c.messages.length;
    const d = c.messages.filter((m: any) => m.status === 'DELIVERED').length;
    const f = c.messages.filter((m: any) => m.status === 'FAILED').length;
    return {
      id: c.id,
      name: c.name,
      sent,
      delivered: d,
      failed: f,
      rate: sent > 0 ? Math.round((d / sent) * 100) : 0,
    };
  });

  // Email stats from Mailchimp
  const email = { sent: 0, openRate: 0, clickRate: 0 };
  const apiKey = process.env.MAILCHIMP_API_KEY;
  const dc = process.env.MAILCHIMP_DC;
  if (apiKey && dc) {
    try {
      const baseUrl = `https://${dc}.api.mailchimp.com/3.0`;
      const authHeader = 'Basic ' + Buffer.from(`anystring:${apiKey}`).toString('base64');
      const res = await fetch(`${baseUrl}/campaigns?count=20&sort_field=send_time&sort_dir=DESC`, {
        headers: { 'Authorization': authHeader },
        cache: 'no-store',
      });
      const data = await res.json();
      if (data.campaigns) {
        email.sent = data.campaigns.reduce((acc: number, c: any) => acc + (c.emails_sent || 0), 0);
        const withOpen = data.campaigns.filter((c: any) => c.report_summary?.open_rate);
        if (withOpen.length) {
          email.openRate = Math.round(withOpen.reduce((acc: number, c: any) => acc + c.report_summary.open_rate * 100, 0) / withOpen.length);
        }
        const withClicks = data.campaigns.filter((c: any) => c.report_summary?.click_rate);
        if (withClicks.length) {
          email.clickRate = Math.round(withClicks.reduce((acc: number, c: any) => acc + c.report_summary.click_rate * 100, 0) / withClicks.length);
        }
      }
    } catch {}
  }

  // SMS stats placeholder (Termii doesn't have a simple list endpoint without a plan)
  const sms = { sent: 0, delivered: 0 };

  return NextResponse.json({ stats, campaigns: campaignStats, whatsapp: { sent: total, delivered, failed, campaigns: campaigns.length }, email, sms });
}


--- cron/fetch-mail ---

/**
 * GET/POST /api/cron/fetch-mail
 *
 * Vercel cron target. Polls IMAP and writes new messages to InboundEmail.
 * Auth: Bearer token in Authorization header matching CRON_SECRET.
 *
 * Schedule (vercel.json): every 2 minutes.
 *
 * Optional query/body param:
 *   ?force=1  — re-scan from the beginning of the inbox (use sparingly)
 */
import { NextRequest, NextResponse } from 'next/server';
import { fetchInboundMail } from '@/lib/mail-fetcher';

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get('authorization');
  if (auth === `Bearer ${secret}`) return true;
  // Vercel cron sends a special header; allow it as a fallback in production
  // when CRON_SECRET is also set in the project.
  const vercelCron = req.headers.get('x-vercel-cron');
  if (process.env.NODE_ENV === 'production' && vercelCron && secret) {
    return true;
  }
  return false;
}

async function handle(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Optional force flag (for manual recovery, not used by Vercel cron)
  if (req.method === 'POST') {
    try {
      const body = await req.json().catch(() => ({}));
      if (body?.force === true) {
        // Caller is admin; clear the lastUid watermark by passing lastUid=0
        process.env.MAIL_IMAP_RESET = '1';
      }
    } catch {
      // no body
    }
  }

  const result = await fetchInboundMail();
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Vercel hobby = 60s; pro = 300s

export async function GET(req: NextRequest) {
  return handle(req);
}
export async function POST(req: NextRequest) {
  return handle(req);
}


--- cron/process ---

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// CRON_SECRET prevents unauthorized calls — set in .env
function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get('authorization');
  return auth === `Bearer ${secret}`;
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results: Record<string, any> = {};
  const now = new Date();

  // ── 1. Drip scheduled messages due to send ──────────────────────────────
  const dueMessages = await prisma.dripScheduledMessage.findMany({
    where: {
      status: 'PENDING',
      scheduledFor: { lte: now },
    },
    take: 50, // process in batches
    include: { user: true, contact: true },
  });

  results.drip = { found: dueMessages.length, sent: 0, failed: 0 };

  for (const msg of dueMessages) {
    let status = 'FAILED';
    let failureReason = '';
    try {
      if (msg.channel === 'whatsapp') {
        await sendWhatsApp(msg.userId, msg.contact.phone, msg.template);
      } else if (msg.channel === 'email') {
        await sendEmail(msg.userId, msg.contact.phone, msg.template);
      } else if (msg.channel === 'sms') {
        await sendSms(msg.userId, msg.contact.phone, msg.template);
      }
      status = 'SENT';
      results.drip.sent++;
    } catch (err: any) {
      failureReason = err.message;
      results.drip.failed++;
    }
    await prisma.dripScheduledMessage.update({
      where: { id: msg.id },
      data: { status, sentAt: status === 'SENT' ? new Date() : null, failureReason: failureReason || null },
    });
  }

  // ── 2. Recurring campaigns due today ─────────────────────────────────────
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  const recurringCampaigns = await prisma.campaign.findMany({
    where: {
      status: 'SCHEDULED',
      recurrence: { not: null },
      scheduledAt: {
        gte: todayStart,
        lte: todayEnd,
      },
    },
    include: {
      user: true,
      messages: { include: { contact: true } },
    },
  });

  results.recurring = { found: recurringCampaigns.length, sent: 0 };

  for (const campaign of recurringCampaigns) {
    try {
      for (const message of campaign.messages) {
        if (message.status === 'PENDING') {
          await sendWhatsApp(campaign.userId, message.contact.phone, campaign.content);
          await prisma.message.update({
            where: { id: message.id },
            data: { status: 'SENT', sentAt: new Date() },
          });
          results.recurring.sent++;
        }
      }

      // Advance to next recurrence
      const nextDate = getNextRecurrence(campaign.scheduledAt!, campaign.recurrence!);
      await prisma.campaign.update({
        where: { id: campaign.id },
        data: { scheduledAt: nextDate },
      });
    } catch (err: any) {
      results.recurring.error = err.message;
    }
  }

  // ── 3. Scheduled (one-time) campaigns due now ────────────────────────────
  const dueCampaigns = await prisma.campaign.findMany({
    where: {
      status: 'SCHEDULED',
      recurrence: null,
      scheduledAt: { lte: now },
    },
    include: {
      user: true,
      messages: { include: { contact: true } },
    },
  });

  results.campaigns = { found: dueCampaigns.length, sent: 0, failed: 0 };

  for (const campaign of dueCampaigns) {
    try {
      for (const message of campaign.messages) {
        if (message.status === 'PENDING') {
          await sendWhatsApp(campaign.userId, message.contact.phone, campaign.content);
          await prisma.message.update({
            where: { id: message.id },
            data: { status: 'SENT', sentAt: new Date() },
          });
          results.campaigns.sent++;
        }
      }

      await prisma.campaign.update({
        where: { id: campaign.id },
        data: { status: 'SENT', sentAt: new Date() },
      });
    } catch (err: any) {
      await prisma.campaign.update({
        where: { id: campaign.id },
        data: { status: 'FAILED' },
      });
      results.campaigns.failed++;
    }
  }

  // ── 4. Trigger automations on contacts added today ───────────────────────
  const todayAdded = await prisma.contact.findMany({
    where: {
      createdAt: { gte: todayStart, lte: todayEnd },
    },
  });

  results.newContacts = todayAdded.length;
  results.automationsTriggered = 0;

  for (const contact of todayAdded) {
    const automations = await prisma.automation.findMany({
      where: { userId: contact.userId, isEnabled: true, trigger: 'contact_added' },
    });

    for (const automation of automations) {
      await triggerAutomation(automation, contact);
      results.automationsTriggered++;
    }
  }

  return NextResponse.json({
    ok: true,
    timestamp: now.toISOString(),
    ...results,
  });
}

// ── Helpers ────────────────────────────────────────────────────────────────

async function sendWhatsApp(userId: string, phone: string, content: string) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/wacli/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, phone, message: content }),
  });
  if (!res.ok) throw new Error(`wacli failed: ${res.status}`);
}

async function sendEmail(userId: string, email: string, content: string) {
  // Uses Mailchimp transactional (Mandrill) or simple send
  // For now, log — email sending requires Mailchimp API setup
  console.log(`[cron] email to ${email}: ${content.substring(0, 50)}`);
}

async function sendSms(userId: string, phone: string, content: string) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/sms/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, phone, message: content }),
  });
  if (!res.ok) throw new Error(`sms failed: ${res.status}`);
}

function getNextRecurrence(current: Date, recurrence: string): Date {
  const next = new Date(current);
  if (recurrence === 'DAILY') next.setDate(next.getDate() + 1);
  else if (recurrence === 'WEEKLY') next.setDate(next.getDate() + 7);
  else if (recurrence === 'MONTHLY') next.setMonth(next.getMonth() + 1);
  return next;
}

async function triggerAutomation(automation: any, contact: any) {
  let actions: any[] = [];
  try { actions = JSON.parse(automation.actions); } catch {}

  actions.sort((a: any, b: any) => a.sequenceOrder - b.sequenceOrder);

  for (const action of actions) {
    const delayMs = (action.delayMinutes || 0) * 60 * 1000;
    const scheduledFor = new Date(Date.now() + delayMs);

    await prisma.dripScheduledMessage.create({
      data: {
        userId: contact.userId,
        contactId: contact.id,
        automationId: automation.id,
        channel: action.channel || 'whatsapp',
        template: action.template || '',
        scheduledFor,
        sequenceOrder: action.sequenceOrder || 0,
        status: 'PENDING',
      },
    });
  }

  await prisma.automation.update({
    where: { id: automation.id },
    data: { lastTriggered: new Date() },
  });

  await prisma.automationExecution.create({
    data: {
      automationId: automation.id,
      contactId: contact.id,
      event: 'triggered',
      payload: JSON.stringify({ trigger: 'contact_added', delay: 'scheduled' }),
    },
  });
}

--- settings/team ---

import { NextRequest, NextResponse } from 'next/server';
import { getSession, hasRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { randomBytes } from 'crypto';

function getUserIdFromCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/sf_token=([^;]+)/);
  if (!match) return null;
  try {
    const payload = JSON.parse(Buffer.from(match[1].split('.')[1], 'base64').toString());
    return payload.sub || null;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const session = await getSession(req as NextRequest);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Only owners/admins can see team
  const membership = await prisma.teamMember.findFirst({
    where: { userId: session.id, OR: [{ role: 'ADMIN' }, { userId: session.id }] },
  });
  if (!membership && !session.isOwner) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Get the owner's account to find all team members under it
  const owner = await prisma.user.findFirst({
    where: { id: session.id, isOwner: true },
    include: {
      teamMembers: {
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { invitedAt: 'asc' },
      },
    },
  });

  // If not owner, find via team membership
  const teamMembers = owner
    ? owner.teamMembers
    : await prisma.teamMember.findMany({
        where: { userId: session.id },
        include: { user: { select: { id: true, name: true, email: true } } },
      });

  const members = teamMembers.map(tm => ({
    id: tm.user.id,
    name: tm.user.name,
    email: tm.user.email,
    role: tm.role,
    joinedAt: tm.joinedAt,
    invitedAt: tm.invitedAt,
  }));

  return NextResponse.json({ members, isOwner: session.isOwner });
}

export async function POST(req: Request) {
  const session = await getSession(req as NextRequest);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.role === 'VIEWER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { email, role } = await req.json();
  if (!email || !role) return NextResponse.json({ error: 'email and role required' }, { status: 400 });
  if (!['ADMIN', 'EDITOR', 'VIEWER'].includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
  }

  // Check if user already exists
  const invitee = await prisma.user.findUnique({ where: { email } });
  if (invitee) {
    // Already a member
    const existing = await prisma.teamMember.findFirst({ where: { userId: invitee.id } });
    if (existing) return NextResponse.json({ error: 'User is already a team member' }, { status: 409 });

    // Add as team member directly
    const tm = await prisma.teamMember.create({
      data: { userId: invitee.id, email, role, joinedAt: new Date() },
    });
    return NextResponse.json({ member: { ...tm, user: { id: invitee.id, name: invitee.name, email } } });
  }

  // Generate invite token and create pending membership
  const token = randomBytes(32).toString('hex');
  const tm = await prisma.teamMember.create({
    data: {
      email,
      role,
      token,
      invitedBy: session.id,
      userId: session.id, // pending, linked to owner
    },
  });

  // TODO: send invite email with magic link: /invite?token=token

  return NextResponse.json({ invite: { email, role, token }, member: null });
}

--- clients ---

import { getJWTSecret } from '@/lib/jwt';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { sendMail } from '@/lib/email';
import { createClientSchema, deleteClientSchema } from '@/lib/validation';


import { randomInt } from 'crypto';

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length: 10 }, () => chars[randomInt(chars.length)]).join('');
}

// GET — list all client accounts (admin only)
export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get('sf_token')?.value;

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    const result = await jwtVerify(token, getJWTSecret());
    payload = result.payload;
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  if (payload.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  const clients = await prisma.user.findMany({
    where: { role: 'CLIENT' },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      plan: true,
      createdAt: true,
      _count: {
        select: {
          leads: true,
          campaigns: true,
          contacts: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ clients });
}

// POST — create a new client account (admin only)
export async function POST(req: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get('sf_token')?.value;

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    const result = await jwtVerify(token, getJWTSecret());
    payload = result.payload;
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  if (payload.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createClientSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.errors.map(e => e.message).join('. ');
    return NextResponse.json({ error: message }, { status: 400 });
  }
  const { name, email, phone } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
  }

  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  const client = await prisma.user.create({
    data: {
      name,
      email,
      phone: phone || null,
      plan: 'FREE',
      role: 'CLIENT',
      passwordHash,
      isOwner: false,
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      createdAt: true,
    },
  });

  // Email temp password directly to the client (never return in API response)
  const loginUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://sendflow-two.vercel.app';
  const mailResult = await sendMail({
    to: email,
    subject: 'Your SendFlow client portal account',
    text: [
      `Hi ${name},`,
      ``,
      `An admin has created a SendFlow account for you.`,
      ``,
      `Login: ${loginUrl}/client-portal`,
      `Email: ${email}`,
      `Temporary Password: ${tempPassword}`,
      ``,
      `Please change your password after your first login.`,
    ].join('\n'),
    html: `
      <p>Hi ${name},</p>
      <p>An admin has created a SendFlow account for you.</p>
      <p style="margin:16px 0">
        <strong>Login:</strong> <a href="${loginUrl}/client-portal">${loginUrl}/client-portal</a><br/>
        <strong>Email:</strong> ${email}<br/>
        <strong>Temporary Password:</strong> <code>${tempPassword}</code>
      </p>
      <p>Please change your password after your first login.</p>
    `,
    testMode: false,
  });

  if (!mailResult.ok) {
    console.error('[clients] failed to email temp password:', mailResult.error, { to: email });
    // Still return 201 — account was created, but warn admin
    return NextResponse.json(
      {
        client,
        warning: 'Account created, but the temporary password could not be emailed. Please generate a password reset for this client.',
      },
      { status: 201 }
    );
  }

  return NextResponse.json(
    {
      client,
      message: 'Account created and login credentials emailed to client.',
    },
    { status: 201 }
  );
}

// DELETE — delete a client account (admin only)
export async function DELETE(req: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get('sf_token')?.value;

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    const result = await jwtVerify(token, getJWTSecret());
    payload = result.payload;
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  if (payload.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  const body = await req.json();
  const parsed = deleteClientSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.errors.map(e => e.message).join('. ');
    return NextResponse.json({ error: message }, { status: 400 });
  }
  const { id } = parsed.data;

  await prisma.user.deleteMany({ where: { id, role: 'CLIENT' } });

  return NextResponse.json({ ok: true });
}

--- links ---

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function getUserIdFromCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/sf_token=([^;]+)/);
  if (!match) return null;
  try {
    const payload = JSON.parse(Buffer.from(match[1].split('.')[1], 'base64').toString());
    return payload.sub || null;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const cookieHeader = req.headers.get('cookie');
  const userId = getUserIdFromCookie(cookieHeader);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const links = await prisma.clickToWhatsAppLink.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ links });
}

export async function POST(req: Request) {
  const cookieHeader = req.headers.get('cookie');
  const userId = getUserIdFromCookie(cookieHeader);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { name, phone, prefillMsg, utmSource, utmMedium, utmCampaign } = await req.json();
  if (!name || !phone) {
    return NextResponse.json({ error: 'name and phone required' }, { status: 400 });
  }

  const link = await prisma.clickToWhatsAppLink.create({
    data: {
      userId,
      name,
      phone: phone.replace(/\D/g, ''),
      prefillMsg: prefillMsg || null,
      utmSource: utmSource || null,
      utmMedium: utmMedium || null,
      utmCampaign: utmCampaign || null,
    },
  });

  return NextResponse.json({ link }, { status: 201 });
}

--- messages ---

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const campaignId = searchParams.get('campaignId');
  if (!campaignId) return NextResponse.json({ error: 'campaignId required' }, { status: 400 });

  const messages = await prisma.message.findMany({
    where: { campaignId },
    include: { contact: { select: { name: true, phone: true } } },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json({ messages });
}

--- leads ---

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    const session = await getSession(req as NextRequest);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const stage = searchParams.get('stage');

    const leads = await prisma.lead.findMany({
      where: {
        userId: session.id,
        ...(stage && { stage }),
      },
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { activities: true } } },
    });

    return NextResponse.json({ leads });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession(req as NextRequest);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, email, phone, company, source, notes } = await req.json();
    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const lead = await prisma.lead.create({
      data: {
        userId: session.id,
        name,
        email: email || null,
        phone: phone || null,
        company: company || null,
        source: source || 'other',
        notes: notes || '',
        stage: 'NEW',
      },
    });

    await prisma.leadActivity.create({
      data: {
        leadId: lead.id,
        userId: session.id,
        type: 'note',
        content: `Lead created via ${source || 'manual'} source.`,
      },
    });

    return NextResponse.json({ lead }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to create lead' }, { status: 500 });
  }
}
