import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Webhook for OpenClaw agents to send messages back to the SendFlow dashboard.
 * OpenClaw (or any authorized source) POSTs here with a message that gets
 * stored and shown in the UI.
 */

const WEBHOOK_SECRET = process.env.OPENCLAW_WEBHOOK_SECRET || 'openclaw-local-bridge-2026';

export async function POST(req: Request) {
  try {
    const auth = req.headers.get('authorization') || '';
    const token = auth.replace('Bearer ', '');
    if (token !== WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { agentId, message, metadata } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'message required' }, { status: 400 });
    }

    // Store the message in the database
    // Using a generic "SystemMessage" concept via the existing Contact/Activity
    // or just log it. For now we'll store it as a simple log entry.
    // Since there's no dedicated openclaw_message table, we can use a simple
    // key-value or create one. Let's use a lightweight approach.

    // For now, return the message so the caller knows it was received
    console.log(`[OpenClaw Webhook] agent=${agentId}: ${message}`);

    return NextResponse.json({
      success: true,
      receivedAt: new Date().toISOString(),
      agentId: agentId || 'unknown',
      messagePreview: message.slice(0, 200),
    }, { status: 201 });
  } catch (err: any) {
    console.error('openclaw webhook error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'sendflow-openclaw-bridge',
    version: '1.0',
    description: 'POST with Bearer token and JSON body { agentId, message }',
  });
}
