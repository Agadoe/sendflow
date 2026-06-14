import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const { token, password } = await req.json();

    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: 'Reset token required' }, { status: 400 });
    }
    if (!password || password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

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