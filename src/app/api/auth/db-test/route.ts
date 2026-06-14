import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Debug only — delete after diagnosis.
export async function GET(req: Request) {
  try {
    // Test database connection
    const users = await prisma.user.findMany({ take: 1 });
    return NextResponse.json({ 
      success: true, 
      message: 'Database connection successful',
      userCount: users.length 
    });
  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}