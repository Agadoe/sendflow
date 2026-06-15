import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || 'development-secret'
);

const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const GROQ_URL    = 'https://api.groq.com/openai/v1/chat/completions';

async function auth(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get('sf_token')?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.role !== 'CLIENT') return null;
    return payload.sub as string;
  } catch { return null; }
}

async function groqEnrich(lead: {
  name: string;
  company: string | null;
  phone: string | null;
  source: string | null;
}): Promise<{ jobTitle: string | null; industry: string | null; linkedinUrl: string | null; website: string | null; address: string | null }> {
  const prompt = `You are a B2B lead enrichment specialist. Given the following lead data from Ghana/West Africa, return everything you know or can reasonably infer about:

- jobTitle: The person's job title (or null if unknown)
- industry: Their industry sector (or null if unknown)
- linkedinUrl: Their LinkedIn profile URL if you can construct it from their name/company (format: https://linkedin.com/in/[slug]) — return null if you can't reasonably guess the slug
- website: Their company website if inferable from company name (return null if unknown)
- address: City and country only (e.g. "Accra, Ghana") if inferable from context

Lead data:
Name: ${lead.name}
Company: ${lead.company || '(unknown)'}
Phone: ${lead.phone || '(unknown)'}
Source: ${lead.source || '(unknown)'}

Respond ONLY with valid JSON matching this schema. No explanation, no markdown:
{"jobTitle": "...", "industry": "...", "linkedinUrl": "...", "website": "...", "address": "..."}`;

  try {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-4-scout-17b-125e',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 300,
      }),
    });

    if (!res.ok) {
      console.error('[enrich] Groq error:', res.status, await res.text());
      return { jobTitle: null, industry: null, linkedinUrl: null, website: null, address: null };
    }

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content?.trim() || '{}';

    // Strip markdown code blocks
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
    const parsed = JSON.parse(cleaned);

    return {
      jobTitle:    parsed.jobTitle    || null,
      industry:    parsed.industry    || null,
      linkedinUrl: parsed.linkedinUrl || null,
      website:     parsed.website     || null,
      address:     parsed.address     || null,
    };
  } catch (err) {
    console.error('[enrich] Groq failed:', err);
    return { jobTitle: null, industry: null, linkedinUrl: null, website: null, address: null };
  }
}

/**
 * POST /api/client-portal/leads/:id/enrich
 * Enriches a lead with AI-inferred data (job title, industry, LinkedIn, website).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await auth(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const lead = await prisma.lead.findFirst({ where: { id, userId } });
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

  const enriched = await groqEnrich({
    name:    lead.name,
    company: lead.company,
    phone:   lead.phone,
    source:  lead.source,
  });

  const updated = await prisma.lead.update({
    where: { id },
    data: enriched,
  });

  await prisma.leadActivity.create({
    data: {
      leadId: id,
      userId,
      type: 'enrichment',
      content: `AI enrichment: jobTitle=${enriched.jobTitle || '—'}, industry=${enriched.industry || '—'}, linkedin=${enriched.linkedinUrl || '—'}, website=${enriched.website || '—'}`,
      metadata: JSON.stringify(enriched),
    },
  });

  return NextResponse.json({
    lead: {
      ...updated,
      notes: JSON.parse(updated.notes || '[]'),
      tags:  JSON.parse(updated.tags  || '[]'),
    },
    enriched,
  });
}