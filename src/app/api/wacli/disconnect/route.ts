import { NextResponse } from 'next/server';

export async function POST() {
  try {
    require('child_process').execSync('wacli logout', { timeout: 10000 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: true });
  }
}