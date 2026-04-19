import { NextResponse } from 'next/server';

export async function POST() {
  try {
    // Generate QR code for WhatsApp pairing
    const { execSync } = require('child_process');
    const output = execSync('wacli auth --qr', { timeout: 30000 }).toString();
    return NextResponse.json({ qr: output, success: true });
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to generate QR', details: e.message }, { status: 500 });
  }
}