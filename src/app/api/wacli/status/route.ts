import { NextResponse } from 'next/server';
import { execSync } from 'child_process';

export async function GET() {
  try {
    execSync('wacli status', { timeout: 10000 });
    return NextResponse.json({ connected: true });
  } catch {
    return NextResponse.json({ connected: false });
  }
}