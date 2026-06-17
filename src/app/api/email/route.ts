import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { NextRequest } from 'next/server';

export async function POST(req: Request) {
  const request = req as NextRequest;
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.id;

  const apiKey = process.env.MAILCHIMP_API_KEY;
  const dc = process.env.MAILCHIMP_DC;
  if (!apiKey || !dc) {
    return NextResponse.json({ error: 'Mailchimp not configured. Add MAILCHIMP_API_KEY and MAILCHIMP_DC to .env.local' }, { status: 500 });
  }

  const { campaignName, subject, content, audienceId } = await req.json();
  if (!campaignName || !subject || !content || !audienceId) {
    return NextResponse.json({ error: 'campaignName, subject, content, and audienceId are required' }, { status: 400 });
  }

  const baseUrl = `https://${dc}.api.mailchimp.com/3.0`;
  const authHeader = 'Basic ' + Buffer.from(`anystring:${apiKey}`).toString('base64');

  try {
    // Create campaign
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

    if (!createRes.ok) {
      return NextResponse.json({ error: campaign.detail || 'Failed to create campaign' }, { status: 400 });
    }

    // Set content
    await fetch(`${baseUrl}/campaigns/${campaign.id}/content`, {
      method: 'PUT',
      headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ html: content }),
    });

    // Send
    const sendRes = await fetch(`${baseUrl}/campaigns/${campaign.id}/actions/send`, {
      method: 'POST',
      headers: { 'Authorization': authHeader },
    });

    if (!sendRes.ok && sendRes.status !== 204) {
      const err = await sendRes.json();
      return NextResponse.json({ error: err.detail || 'Failed to send campaign' }, { status: 400 });
    }

    return NextResponse.json({ success: true, campaignId: campaign.id, status: 'sent' });
  } catch (err) {
    return NextResponse.json({ error: 'Mailchimp API error' }, { status: 500 });
  }
}
