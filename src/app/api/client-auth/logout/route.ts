import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const origin = req.headers.get('origin') || 'https://localhost';
  const response = NextResponse.redirect(`${origin}/client-portal/login`);
  response.cookies.delete('sf_token');
  return response;
}

export async function GET() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete('sf_token');
  return response;
}