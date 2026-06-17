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

    // Security: verify this is actually a forgot-password token, not an email-verification token.
    if (!record.identifier.startsWith('forgot:')) {
      return NextResponse.json({ error: 'Invalid reset token' }, { status: 401 });
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

    // Notify user that their password was changed
    try {
      const { sendMail } = await import('@/lib/email');
      await sendMail({
        to: email,
        subject: 'Your SendFlow password was changed',
        text: `Hi,\n\nYour SendFlow password was just changed. If this was you, you can ignore this email.\n\nIf you did not make this change, please contact support immediately.`,
        html: `<p>Hi,</p>
<p>Your SendFlow password was just changed. If this was you, you can ignore this email.</p>
<p>If you did not make this change, please <strong>contact support immediately</strong>.</p>`,
        testMode: false,
      });
    } catch {
      // Best-effort notification; don't fail the reset if email fails
    }

    return NextResponse.json(
      { message: 'Password updated. You can now sign in with your new password.' },
      { status: 200 }
    );
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to reset password' }, { status: 500 });
  }
}