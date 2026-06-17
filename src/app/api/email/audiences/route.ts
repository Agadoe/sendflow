import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { NextRequest } from 'next/server';

export async function GET(req: Request) {
  const session = await getSession(req as NextRequest);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
