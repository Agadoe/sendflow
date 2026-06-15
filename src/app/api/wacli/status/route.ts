import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const DAEMON_URL = process.env.WACLI_DAEMON_URL || 'http://127.0.0.1:4555';

export async function GET() {
  try {
    // Get the current user
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch status from the multi-tenant daemon
    const res = await fetch(`${DAEMON_URL}/status`, {
      headers: {
        'X-User-Id': user.id
      }
    });
    
    if (!res.ok) {
      // Daemon error — WhatsApp might be down or starting
      return NextResponse.json({ connected: false, state: 'daemon_error', detail: `HTTP ${res.status}` });
    }
    
    const data = await res.json();
    
    // Update user's wacli status in the database
    if (data.state) {
      await prisma.user.update({
        where: { id: user.id },
        data: { 
          wacliStatus: data.state,
          wacliPhone: data.phone || null,
          wacliLastConnectedAt: data.connected ? new Date() : null
        }
      });
    }
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching wacli status:', error);
    // Fetch failed entirely — daemon is not reachable
    return NextResponse.json({ connected: false, state: 'unreachable' });
  }
}