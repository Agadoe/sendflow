import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const DAEMON_URL = process.env.WACLI_DAEMON_URL || 'http://127.0.0.1:4555';

// POST /connect → regenerate QR and reconnect
export async function POST() {
  try {
    // Get the current user
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const res = await fetch(`${DAEMON_URL}/connect`, { 
      method: 'POST',
      headers: {
        'X-User-Id': user.id
      }
    });
    
    const data = await res.json();
    if (!res.ok) return NextResponse.json(data, { status: res.status });
    
    // Update user's wacli status
    await prisma.user.update({
      where: { id: user.id },
      data: { 
        wacliStatus: data.state || 'QR_READY'
      }
    });
    
    return NextResponse.json({ success: true, state: data.state });
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to reconnect: ' + e.message }, { status: 500 });
  }
}

// GET /connect → get current QR
export async function GET() {
  try {
    // Get the current user
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const res = await fetch(`${DAEMON_URL}/qr`, {
      headers: {
        'X-User-Id': user.id
      }
    });
    
    const data = await res.json();
    if (!res.ok) return NextResponse.json(data, { status: res.status });
    
    // Update user's QR code
    await prisma.user.update({
      where: { id: user.id },
      data: { 
        wacliQrCode: data.qr,
        wacliStatus: data.state || 'QR_READY'
      }
    });
    
    return NextResponse.json({ qr: data.qr, state: data.state, success: true });
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to get QR: ' + e.message }, { status: 500 });
  }
}