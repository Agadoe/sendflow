import { NextResponse } from 'next/server';

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

  const apiKey = process.env.MAILCHIMP_API_KEY;
  const dc = process.env.MAILCHIMP_DC;
  if (!apiKey || !dc) {
    return NextResponse.json({ audiences: [], error: 'Mailchimp not configured' }, { status: 200 });
  }

  const baseUrl = `https://${dc}.api.mailchimp.com/3.0`;
  const authHeader = 'Basic ' + Buffer.from(`anystring:${apiKey}`).toString('base64');

  try {
    const res = await fetch(`${baseUrl}/lists?count=100`, {
      headers: { 'Authorization': authHeader },
    });
    const data = await res.json();

    const audiences = (data.lists || []).map((l: any) => ({
      id: l.id,
      name: l.name,
      memberCount: l.stats?.member_count || 0,
    }));

    return NextResponse.json({ audiences });
  } catch {
    return NextResponse.json({ audiences: [] });
  }
}
