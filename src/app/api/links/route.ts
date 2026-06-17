import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { NextRequest } from 'next/server';

export async function GET(req: Request) {
  const request = req as NextRequest;
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const links = await prisma.clickToWhatsAppLink.findMany({
    where: { userId: session.id },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ links });
}

export async function POST(req: Request) {
  const request = req as NextRequest;
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { name, phone, prefillMsg, utmSource, utmMedium, utmCampaign } = await req.json();
  if (!name || !phone) {
    return NextResponse.json({ error: 'name and phone required' }, { status: 400 });
  }

  const link = await prisma.clickToWhatsAppLink.create({
    data: {
      userId,
      name,
      phone: phone.replace(/\D/g, ''),
      prefillMsg: prefillMsg || null,
      utmSource: utmSource || null,
      utmMedium: utmMedium || null,
      utmCampaign: utmCampaign || null,
    },
  });

  return NextResponse.json({ link }, { status: 201 });
}