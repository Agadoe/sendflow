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

export async function POST(
  req: Request,
  { params }: { params: { campaignId: string } }
) {
  const cookieHeader = req.headers.get('cookie');
  const userId = getUserIdFromCookie(cookieHeader);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const apiKey = process.env.MAILCHIMP_API_KEY;
  const dc = process.env.MAILCHIMP_DC;
  if (!apiKey || !dc) {
    return NextResponse.json({ error: 'Mailchimp not configured' }, { status: 500 });
  }

  const { campaignId } = params;
  const baseUrl = `https://${dc}.api.mailchimp.com/3.0`;
  const authHeader = 'Basic ' + Buffer.from(`anystring:${apiKey}`).toString('base64');

  try {
    const res = await fetch(`${baseUrl}/campaigns/${campaignId}/actions/resend`, {
      method: 'POST',
      headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ resend_only: true, sent_to: ['non_openers'] }),
    });

    if (!res.ok) {
      const err = await res.json();
      return NextResponse.json({ error: err.detail || 'Failed to resend to non-openers' }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: 'Resent to non-openers' });
  } catch {
    return NextResponse.json({ error: 'Mailchimp API error' }, { status: 500 });
  }
}
