import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { success: true },
    {
      headers: {
        'Set-Cookie': 'sf_token=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax',
      },
    }
  );
}
