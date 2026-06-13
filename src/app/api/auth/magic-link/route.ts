import { NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { sendMail, APPROVAL_INBOX } from '@/lib/email';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || 'development-secret'
);

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

export async function POST(req: Request) {
  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const email = (body.email || '').trim().toLowerCase();
  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
  }

  // Test mode forces delivery to the approval inbox. Default ON until the
  // email-verification flow is signed off by Don — flip via env when ready.
  const testMode = process.env.MAGIC_LINK_TEST_MODE !== 'false';

  // Capture attribution from the request URL (e.g. ?ref=leadops&utm_campaign=...)
  const reqUrl = new URL(req.url);
  const attribution = captureAttribution(reqUrl);

  // Sign a 15-minute token with the email + attribution claims.
  const token = await new SignJWT({ sub: email, ...attribution })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(JWT_SECRET);

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
    console.error('[magic-link] SMTP failed:', result.error, { to: email, testMode, smtpHost: process.env.SMTP_HOST, smtpUserSet: !!process.env.SMTP_USER, smtpPassLen: (process.env.SMTP_PASS || '').length, smtpPassTail: (process.env.SMTP_PASS || '').slice(-3) });
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
