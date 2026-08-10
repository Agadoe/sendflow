import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { fetchDaemon, formatPhone, DAEMON_URL } from '@/lib/daemon-fetch';



// POST /disconnect → destroy WhatsApp session via daemon
export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const res = await fetchDaemon('/wacli/disconnect', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': user.id
      },
      body: JSON.stringify({})
    });
    const data = await res.json();
    if (!res.ok) return NextResponse.json(data, { status: res.status });

    await prisma.user.update({
      where: { id: user.id },
      data: {
        wacliStatus: 'DISCONNECTED',
        wacliQrCode: null,
        wacliPhone: null,
        wacliLastConnectedAt: null,
      }
    });

    return NextResponse.json({ success: true, state: 'DISCONNECTED' });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
