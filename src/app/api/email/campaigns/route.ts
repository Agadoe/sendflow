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
    return NextResponse.json({ campaigns: [], error: 'Mailchimp not configured' }, { status: 200 });
  }

  const baseUrl = `https://${dc}.api.mailchimp.com/3.0`;
  const authHeader = 'Basic ' + Buffer.from(`anystring:${apiKey}`).toString('base64');

  try {
    const res = await fetch(`${baseUrl}/campaigns?count=50&sort_field=send_time&sort_dir=DESC`, {
      headers: { 'Authorization': authHeader },
    });
    const data = await res.json();

    const campaigns = (data.campaigns || []).map((c: any) => ({
      id: c.id,
      name: c.settings?.title || c.settings?.subject_line || 'Untitled',
      subject: c.settings?.subject_line,
      status: c.status?.toUpperCase(),
      sentAt: c.send_time ? new Date(c.send_time).toISOString() : null,
      emailsSent: c.emails_sent || 0,
      opens: c.report_summary?.open_rate ? Math.round(c.report_summary.open_rate * 100) : null,
      clicks: c.report_summary?.click_rate ? Math.round(c.report_summary.click_rate * 100) : null,
    }));

    return NextResponse.json({ campaigns });
  } catch {
    return NextResponse.json({ campaigns: [] });
  }
}

export async function POST(req: Request) {
  const cookieHeader = req.headers.get('cookie');
  const userId = getUserIdFromCookie(cookieHeader);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const apiKey = process.env.MAILCHIMP_API_KEY;
  const dc = process.env.MAILCHIMP_DC;
  if (!apiKey || !dc) {
    return NextResponse.json({ error: 'Mailchimp not configured' }, { status: 500 });
  }

  const { campaignName, subject, content, audienceId } = await req.json();
  if (!campaignName || !subject || !content || !audienceId) {
    return NextResponse.json({ error: 'All fields required' }, { status: 400 });
  }

  const baseUrl = `https://${dc}.api.mailchimp.com/3.0`;
  const authHeader = 'Basic ' + Buffer.from(`anystring:${apiKey}`).toString('base64');

  try {
    const createRes = await fetch(`${baseUrl}/campaigns`, {
      method: 'POST',
      headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'regular',
        recipients: { list_id: audienceId },
        settings: { subject_line: subject, title: campaignName, from_name: 'SendFlow', reply_to: 'hello@sendflow.com' },
      }),
    });
    const campaign = await createRes.json();
    if (!createRes.ok) return NextResponse.json({ error: campaign.detail || 'Failed' }, { status: 400 });

    await fetch(`${baseUrl}/campaigns/${campaign.id}/content`, {
      method: 'PUT',
      headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ html: content }),
    });

    const sendRes = await fetch(`${baseUrl}/campaigns/${campaign.id}/actions/send`, {
      method: 'POST',
      headers: { 'Authorization': authHeader },
    });
    if (!sendRes.ok && sendRes.status !== 204) {
      const err = await sendRes.json();
      return NextResponse.json({ error: err.detail || 'Failed to send' }, { status: 400 });
    }

    return NextResponse.json({ success: true, campaign });
  } catch {
    return NextResponse.json({ error: 'Mailchimp API error' }, { status: 500 });
  }
}
