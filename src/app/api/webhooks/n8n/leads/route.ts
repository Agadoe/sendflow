import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { PLANS, checkContactLimit } from '@/lib/plans';

export async function POST(req: Request) {
  try {
    // Authenticate via API key
    const apiKey = req.headers.get('x-sendflow-key');
    if (!apiKey) {
      return NextResponse.json({ error: 'API key required' }, { status: 401 });
    }

    const keyRecord = await prisma.apiKey.findFirst({
      where: { key: apiKey },
      select: { userId: true },
    });

    if (!keyRecord) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    const userId = keyRecord.userId;

    // Update last used timestamp
    await prisma.apiKey.updateMany({
      where: { key: apiKey },
      data: { lastUsed: new Date() },
    });

    const body = await req.json();
    const { leads } = body;

    if (!Array.isArray(leads) || leads.length === 0) {
      return NextResponse.json({ error: 'leads array required' }, { status: 400 });
    }

    // Check contact limit
    const overage = await checkContactLimit(userId, leads.length, prisma);
    if (overage > 0) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { plan: true },
      });
      const plan = user?.plan ?? 'FREE';
      const max = PLANS[plan as keyof typeof PLANS]?.maxContacts ?? 100;
      return NextResponse.json({
        error: `Contact limit reached. Plan allows ${max} contacts. This import would exceed by ${overage}.`,
        code: 'CONTACT_LIMIT_EXCEEDED',
      }, { status: 403 });
    }

    const results = { created: 0, skipped: 0, errors: [] as string[] };
    const createdContacts = [];

    for (const lead of leads) {
      try {
        const phone = (lead.phone || '').replace(/\D/g, '');
        if (phone.length < 9) {
          results.errors.push(`Invalid phone: ${lead.phone}`);
          continue;
        }

        // Check for duplicates
        const existing = await prisma.contact.findFirst({
          where: { userId, phone },
        });
        if (existing) {
          results.skipped++;
          continue;
        }

        // Extract tags from lead data
        const tags = [];
        if (lead.industry) tags.push(lead.industry);
        if (lead.company_size) tags.push(lead.company_size);
        if (lead.fit_score) tags.push(`fit-${lead.fit_score}`);
        if (lead.source) tags.push(lead.source);

        const contact = await prisma.contact.create({
          data: {
            userId,
            phone,
            name: lead.name || null,
            tags: JSON.stringify(tags),
            optedIn: false, // n8n leads start as cold outreach
            optedInSource: lead.source || 'n8n-lead-gen',
          },
        });

        results.created++;
        createdContacts.push({
          id: contact.id,
          phone: contact.phone,
          name: contact.name,
        });
      } catch (e: any) {
        results.errors.push(`${lead.phone}: ${e.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      summary: results,
      contacts: createdContacts,
    }, { status: 201 });

  } catch (err: any) {
    console.error('n8n webhook error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Health check for n8n to verify connectivity
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'sendflow-n8n-webhook',
    version: '1.0',
  });
}
