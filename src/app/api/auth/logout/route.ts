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
