import { buildAuthCookie } from '@/lib/cookie';
import { getJWTSecret } from '@/lib/jwt';
import { NextResponse } from 'next/server';
import { jwtVerify, SignJWT } from 'jose';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, clientKey } from '@/lib/rate-limit';


const ATTRIBUTION_CLAIMS = [
  'ref',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
] as const;

const LIMIT = { max: 10, windowSec: 60 };

export async function GET(req: Request) {
  const limit = checkRateLimit(clientKey(req, 'auth:verify'), LIMIT);
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many attempts. Try again in a minute.' },
      { status: 429, headers: { 'Retry-After': String(limit.resetInSec) } }
    );
  }

  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');
  if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 });

  try {
    const { payload } = await jwtVerify(token, getJWTSecret());
    const email = payload.sub as string;
    if (!email) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    // Pull attribution claims from the magic-link JWT, if any.
    const attribution: Record<string, string> = {};
    for (const k of ATTRIBUTION_CLAIMS) {
      const v = payload[k];
      if (typeof v === 'string' && v) attribution[k] = v;
    }

    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // First-time verify creates the user. Free plan, 14-day trial copy.
      // Note: this is a magic-link flow, not the standard /register form, so
      // we don't collect name/password here — those can be added post-login.
      user = await prisma.user.create({
        data: { email, name: email.split('@')[0] },
      });
    }

    // Mark the email as verified (idempotent — only set the timestamp once).
    if (!user.emailVerified) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: new Date() },
      });
    }

    // TODO(iter 4+): persist attribution to a `LeadAttribution` table
    //   so the admin dashboard can show "this user came from leadops campaign X".
    //   For iter 3 we just pass it through to the session payload for the
    //   client to read on first-paint.
    if (Object.keys(attribution).length > 0) {
      console.log(`[verify] attribution for ${email}:`, attribution);
    }

    const sessionToken = await new SignJWT({
      sub: user.id,
      email: user.email,
      ...attribution,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(getJWTSecret());

    return NextResponse.json(
      {
        user: {
          id: user.id,
          email: user.email,
          emailVerified: user.emailVerified,
          role: user.role,
          plan: user.plan,
        },
        attribution,
      },
      {
        headers: {
          'Set-Cookie': buildAuthCookie(sessionToken, 7 * 24 * 60 * 60),
        },
      }
    );
  } catch {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
  }
}
