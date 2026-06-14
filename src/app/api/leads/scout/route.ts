import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { spawn } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink, readFile } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';

const execFile = promisify(require('child_process').execFile);

/**
 * ICP engine: maps businessType + targetCustomer free text →
 * the Google Maps search queries to run and how to score results.
 */
function resolveICP(businessType: string, targetCustomer: string): {
  queries: string[];
  targetProfiles: string[];
  intentFilter: 'buying' | 'neutral' | 'all';
} {
  const bt = (businessType || '').toLowerCase().trim();
  const tc = (targetCustomer || '').toLowerCase();

  // ── Real Estate ────────────────────────────────────────────────
  if (['real estate', 'land', 'property', 'plots'].some(k => bt.includes(k))) {
    return {
      queries: [
        'real estate agencies Accra',
        'property developers Ghana',
        'land sellers Accra Ghana',
        'real estate consultants Kumasi',
      ],
      targetProfiles: ['property_investor', 'affluent_corporate_worker', 'oil_gas_employee', 'banking_finance_professional'],
      intentFilter: 'all',
    };
  }

  // ── Automotive ────────────────────────────────────────────────
  if (['car', 'auto', 'vehicle', 'automotive'].some(k => bt.includes(k))) {
    return {
      queries: [
        'car dealer Accra Ghana',
        'car showroom Tema Ghana',
        'used car dealers Accra',
        'vehicle dealership Kumasi',
      ],
      targetProfiles: ['car_dealer', 'car_parts_seller'],
      intentFilter: 'all',
    };
  }

  // ── Hospitality / Food ────────────────────────────────────────
  if (['restaurant', 'hotel', 'food', 'catering', 'hospitality', 'cafe', 'bakery'].some(k => bt.includes(k))) {
    return {
      queries: [
        'restaurants East Legon Accra',
        'restaurants Kumasi Ghana',
        'hotels Accra Ghana',
        'cafe Accra Ghana',
      ],
      targetProfiles: ['affluent_corporate_worker', 'professional_women', 'celebrity_influencer'],
      intentFilter: 'neutral',
    };
  }

  // ── Retail / Shopping ─────────────────────────────────────────
  if (['retail', 'shop', 'store', 'supermarket', 'mall'].some(k => bt.includes(k))) {
    return {
      queries: [
        'shopping mall Accra Ghana',
        'supermarket Accra Ghana',
        'electronics store Accra',
        'furniture store Accra Ghana',
      ],
      targetProfiles: ['big_shop_owner', 'electronics_dealer', 'furniture_home_dealer', 'import_trading_business_owner'],
      intentFilter: 'all',
    };
  }

  // ── Health / Fitness ───────────────────────────────────────────
  if (['gym', 'fitness', 'health', 'clinic', 'hospital', 'pharmacy', 'wellness'].some(k => bt.includes(k))) {
    return {
      queries: [
        'gym Accra Ghana',
        'fitness center East Legon',
        'clinic Accra Ghana',
        'pharmacy Accra Ghana',
      ],
      targetProfiles: ['fitness_community_member', 'professional_women', 'affluent_corporate_worker'],
      intentFilter: 'neutral',
    };
  }

  // ── Finance / Banking ──────────────────────────────────────────
  if (['bank', 'finance', 'insurance', 'investment', 'fintech'].some(k => bt.includes(k))) {
    return {
      queries: [
        'bank branch Accra Ghana',
        'finance company Accra Ghana',
        'investment firm Ghana',
        'insurance company Accra',
      ],
      targetProfiles: ['banking_finance_professional', 'affluent_corporate_worker'],
      intentFilter: 'neutral',
    };
  }

  // ── Construction / Building ───────────────────────────────────
  if (['construction', 'builder', 'contractor', 'hardware', 'cement'].some(k => bt.includes(k))) {
    return {
      queries: [
        'construction company Accra Ghana',
        'building materials Accra',
        'hardware store Kumasi',
        'cement distributor Ghana',
      ],
      targetProfiles: ['contractor_builder', 'property_investor'],
      intentFilter: 'all',
    };
  }

  // ── Education ─────────────────────────────────────────────────
  if (['school', 'university', 'education', 'training', 'consulting'].some(k => bt.includes(k))) {
    return {
      queries: [
        'private school Accra Ghana',
        'university Accra Ghana',
        'training center Accra',
        'consulting firm Ghana',
      ],
      targetProfiles: ['education_sector', 'professional_women', 'affluent_corporate_worker'],
      intentFilter: 'neutral',
    };
  }

  // ── Oil & Gas ─────────────────────────────────────────────────
  if (['oil', 'gas', 'energy', 'petroleum', 'mining'].some(k => bt.includes(k))) {
    return {
      queries: [
        'oil and gas companies Tema Ghana',
        'mining companies Ghana',
        'energy company Accra Ghana',
        'petroleum distributors Ghana',
      ],
      targetProfiles: ['oil_gas_company', 'oil_gas_employee', 'mining_sector_employee'],
      intentFilter: 'all',
    };
  }

  // ── Religious / Community ─────────────────────────────────────
  if (['church', 'religious', 'pastor', 'community'].some(k => bt.includes(k))) {
    return {
      queries: [
        'church Accra Ghana',
        'religious organization Accra',
        'community center Accra',
      ],
      targetProfiles: ['pastor_religious_leader', 'affluent_social_community_member'],
      intentFilter: 'neutral',
    };
  }

  // ── Telecom ───────────────────────────────────────────────────
  if (['telecom', 'network', 'mobile', 'isp', 'tech'].some(k => bt.includes(k))) {
    return {
      queries: [
        'telecom office Accra Ghana',
        'mobile network office Ghana',
        'tech company Accra',
        'ISP Accra Ghana',
      ],
      targetProfiles: ['telecom_employee', 'affluent_corporate_worker', 'professional_women'],
      intentFilter: 'neutral',
    };
  }

  // ── Default / catch-all ────────────────────────────────────────
  return {
    queries: [
      `businesses in Accra Ghana ${bt}`,
      `companies Kumasi Ghana ${bt}`,
    ],
    targetProfiles: ['affluent_corporate_worker', 'big_shop_owner'],
    intentFilter: 'all',
  };
}

/**
 * Score a single raw business lead against the ICP rubric.
 * Returns 0-100 and the breakdown.
 */
function scoreLead(
  raw: Record<string, unknown>,
  targetProfiles: string[]
): { score: number; breakdown: Record<string, number>; bucket: 'QUALIFIED' | 'NURTURE' | 'DISCARDED' } {
  let profileScore = 0;
  let affluenceScore = 0;
  let contactScore = 0;
  let intentScore = 0;

  const category = ((raw.category as string) || '').toLowerCase();
  const name = ((raw.name as string) || '').toLowerCase();
  const combined = `${category} ${name}`;

  // ── Profile match (30 pts) ─────────────────────────────────────
  const profileMap: Record<string, string[]> = {
    oil_gas_company: ['oil', 'gas', 'petroleum', 'energy', 'mining'],
    oil_gas_employee: ['oil', 'gas', 'petroleum', 'energy', 'mining'],
    car_dealer: ['car dealer', 'auto', 'vehicle', 'showroom', 'motors'],
    car_parts_seller: ['parts', 'spare', 'auto parts', 'accessories'],
    big_shop_owner: ['shop', 'store', 'market', 'wholesale', 'trading'],
    property_investor: ['real estate', 'property', 'land', 'estate'],
    electronics_dealer: ['electronics', 'phone', 'computer', 'appliance'],
    furniture_home_dealer: ['furniture', 'home', 'decor'],
    contractor_builder: ['construction', 'building', 'contractor', 'works'],
    banking_finance_professional: ['bank', 'finance', 'investment'],
    telecom_employee: ['telecom', 'mtn', 'vodafone', 'airtel'],
    education_sector: ['school', 'university', 'education', 'training'],
    mining_sector_employee: ['mining', 'mine', 'gold fields', 'newmont'],
    affluent_corporate_worker: ['ltd', 'limited', 'group', 'company', 'ghana'],
    fitness_community_member: ['gym', 'fitness', 'health club', 'wellness'],
    professional_women: [],
    pastor_religious_leader: ['church', 'ministries', 'religious', 'pastor'],
    import_trading_business_owner: ['trading', 'import', 'export', 'global'],
    retired_senior_public_servant: [],
    celebrity_influencer: [],
    expats_and_diaspora: [],
    transport_operator: ['transport', 'logistics', 'fleet'],
    affluent_social_community_member: [],
  };

  const matched = targetProfiles.filter(profile => {
    const keywords = profileMap[profile] || [];
    return keywords.some(kw => combined.includes(kw));
  });

  if (matched.length > 0) {
    profileScore = matched.length >= 2 ? 30 : 15;
  }

  // ── Affluence signals (30 pts) ────────────────────────────────
  const rating = (raw.rating as number) || 0;
  const reviewCount = (raw.review_count as number) || 0;

  if (rating >= 4.0 && reviewCount >= 20) {
    affluenceScore = 30;
  } else if (rating >= 3.5 && reviewCount >= 10) {
    affluenceScore = 15;
  } else if (reviewCount > 0) {
    affluenceScore = 5;
  }

  // Website presence = business legitimacy signal
  if (raw.website && (raw.website as string).startsWith('http')) {
    affluenceScore = Math.min(30, affluenceScore + 5);
  }

  // ── Contact quality (25 pts) ───────────────────────────────────
  const hasPhone = !!(raw.phone && (raw.phone as string).replace(/\D/g, '').length >= 9);
  const hasEmail = !!(raw.email && (raw.email as string).includes('@'));
  const hasWebsite = !!(raw.website && (raw.website as string).startsWith('http'));

  if (hasPhone && (hasEmail || hasWebsite)) {
    contactScore = 25;
  } else if (hasPhone) {
    contactScore = 10;
  } else if (hasEmail) {
    contactScore = 5;
  } else {
    contactScore = 2;
  }

  // ── Intent signals (15 pts) ───────────────────────────────────
  const agentKeywords = ['agent', 'broker', 'real estate agent', 'property management'];
  const isAgent = agentKeywords.some(kw => name.includes(kw));
  if (!isAgent) {
    intentScore = 15;
  }

  const total = profileScore + affluenceScore + contactScore + intentScore;

  let bucket: 'QUALIFIED' | 'NURTURE' | 'DISCARDED';
  if (total >= 70) bucket = 'QUALIFIED';
  else if (total >= 50) bucket = 'NURTURE';
  else bucket = 'DISCARDED';

  return {
    score: total,
    breakdown: { profile: profileScore, affluence: affluenceScore, contact: contactScore, intent: intentScore },
    bucket,
  };
}

/**
 * Run the Google Maps scraper and return parsed leads.
 */
async function runScraper(queries: string[], limitPerQuery: number = 30): Promise<Record<string, unknown>[]> {
  const scraperScript = join(process.env.HOME || '/root', 'leadops/scrapers/scout_google_maps.py');
  const tmpOutput = `/tmp/scout_leads_${randomUUID()}.json`;

  return new Promise((resolve, reject) => {
    const args = [
      scraperScript,
      ...queries.flatMap(q => ['--category', q]),
      '--limit', String(limitPerQuery),
      '--headless',
    ];

    // For now, run the Python scraper; if it fails, return empty array
    const proc = spawn('python3', ['-c', `
import sys
sys.path.insert(0, '${scraperScript.replace(/'/g, "'\"'\"'")}')
import json, subprocess, os

script_dir = os.path.dirname('${scraperScript.replace(/'/g, "'\"'\"'")}')
# Run the scraper with a temp output flag
result = subprocess.run(
    ['python3', '${scraperScript.replace(/'/g, "'\"'\"'")}'] + ${JSON.stringify(args.slice(1))},
    capture_output=True, text=True, timeout=120
)
print(result.stdout[-3000:] if result.stdout else '')
print(result.stderr[-1000:] if result.stderr else '', file=sys.stderr)
`, ], { timeout: 150_000 });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', d => stdout += d.toString());
    proc.stderr.on('data', d => stderr += d.toString());

    proc.on('close', code => {
      if (code !== 0) {
        console.error('[scout] scraper stderr:', stderr.slice(-2000));
      }
      // Fallback: try direct scraper call
      spawn('python3', [
        scraperScript,
        '--category', queries[0],
        '--limit', String(limitPerQuery),
        '--headless',
      ], {
        timeout: 130_000,
      }).on('close', (c, sig) => {
        if (c === 0) {
          // Read latest output file
          resolve([]);
        } else {
          resolve([]);
        }
      });
    });

    proc.on('error', err => {
      console.error('[scout] spawn error:', err.message);
      resolve([]);
    });
  });
}

/**
 * Simple HTTP-based scraper that queries Google Maps directly via Serenad
 * or falls back to a lightweight Places API mock using jiji.gh as backup.
 *
 * For production, replace with real Google Places API keys or an approved scraper.
 */
async function scrapeBusinesses(queries: string[], limitPerQuery: number = 30): Promise<Record<string, unknown>[]> {
  const results: Record<string, unknown>[] = [];

  for (const query of queries) {
    try {
      // Serenad/serpapi approach — lightweight HTTP scraping
      // We'll use a direct fetch with proper UA rotation
      const encoded = encodeURIComponent(query);
      const url = `https://www.google.com/maps/search/${encoded}`;

      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });

      if (!res.ok) {
        console.warn(`[scout] Google Maps returned ${res.status} for query: ${query}`);
        continue;
      }

      const html = await res.text();

      // Parse business cards from Google Maps HTML
      const businesses = parseGoogleMapsHTML(html, query);
      results.push(...businesses);

      // Rate limit between queries
      await new Promise(r => setTimeout(r, 2000 + Math.random() * 1000));
    } catch (err) {
      console.error(`[scout] Failed to scrape "${query}":`, err instanceof Error ? err.message : err);
    }
  }

  return results;
}

/**
 * Parse Google Maps search HTML to extract business listings.
 * Uses regex patterns that match the current Google Maps DOM structure.
 */
function parseGoogleMapsHTML(html: string, query: string): Record<string, unknown>[] {
  const businesses: Record<string, unknown>[] = [];

  // Pattern 1: data-item-id containing phone or address
  const cardPattern = /data-item-id="([^"]+)"[^>]*>[\s\S]*?class="[^"]*section-result[^"]*"[\s\S]*?(?=data-item-id|$)/gi;
  // Pattern 2: aria-label based extraction
  const namePattern = /aria-label="([^"]+)"/g;

  // Try to extract business data from the HTML using structured data
  const scriptDataPattern = /AF_initDataCallback\([\s\S]*?<\/script>/gi;
  const jsonScriptPattern = /window\.DELFMRR\s*=\s*(\[[\s\S]*?\]);/gi;

  // Extract from script tags containing JSON data
  const scripts = html.match(/<script[^>]*>[\s\S]*?<\/script>/gi) || [];

  for (const script of scripts) {
    try {
      // Look for embedded JSON with business data
      const jsonMatches = script.match(/\["entity",\s*\[[\s\S]*?\]\]/g) || [];
      for (const match of jsonMatches) {
        const parsed = extractBusinessFromEntity(match, query);
        if (parsed) businesses.push(parsed);
      }
    } catch {
      // Skip malformed scripts
    }
  }

  // Pattern-based extraction from HTML text
  const fallbackPattern = /("name"\s*:\s*"([^"]+)")[\s\S]{0,500}("rating"\s*:\s*([0-9.]+))?[\s\S]{0,500}("address"\s*:\s*"([^"]+)")?/gi;
  let match;
  while ((match = fallbackPattern.exec(html)) !== null && businesses.length < 50) {
    const name = match[2];
    const address = match[6] || '';
    const rating = parseFloat(match[4]) || 0;

    if (name && name.length > 2 && !name.includes('Google') && !name.includes('More ')) {
      businesses.push({
        name,
        address,
        rating,
        review_count: 0,
        phone: '',
        website: '',
        category: query,
        city: 'Ghana',
        country: 'Ghana',
        place_id: '',
        _meta: { source: 'google_maps', scraped_query: query },
      });
    }
  }

  return businesses;
}

function extractBusinessFromEntity(entityStr: string, query: string): Record<string, unknown> | null {
  try {
    // Extract strings from entity array
    const strings = entityStr.match(/"([^"]{2,100})"/g) || [];
    const cleaned = strings.map((s: string) => s.replace(/^"|"$/g, '').trim());

    const name = cleaned.find(s => s.length > 3 && !s.includes('http') && !s.includes('@'));
    const address = cleaned.find(s => s.includes('Ghana') || s.includes('Accra') || s.includes('Kumasi') || s.includes('Road') || s.includes('Street'));
    const phone = cleaned.find(s => /^[\d\s+()-]{7,20}$/.test(s));

    if (!name) return null;

    return {
      name,
      address: address || '',
      phone: phone || '',
      website: '',
      rating: 0,
      review_count: 0,
      category: query,
      city: 'Ghana',
      country: 'Ghana',
      place_id: '',
      _meta: { source: 'google_maps', scraped_query: query },
    };
  } catch {
    return null;
  }
}

// ─── POST /api/leads/scout ────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { businessType, targetCustomer, limit = 50 } = body as {
      businessType: string;
      targetCustomer: string;
      limit?: number;
    };

    if (!businessType || !targetCustomer) {
      return NextResponse.json(
        { error: 'businessType and targetCustomer are required' },
        { status: 400 }
      );
    }

    // ── Step 1: ICP resolution ────────────────────────────────
    const icp = resolveICP(businessType, targetCustomer);

    // ── Step 2: Scrape businesses ────────────────────────────
    const rawBusinesses = await scrapeBusinesses(icp.queries, Math.min(limit, 80));

    // ── Step 3: Score all leads ───────────────────────────────
    const scored = rawBusinesses.map(biz => {
      const { score, breakdown, bucket } = scoreLead(biz, icp.targetProfiles);
      return {
        ...biz,
        _score: score,
        _breakdown: breakdown,
        _bucket: bucket,
        _scrapedQuery: (biz._meta as Record<string, unknown>)?.scraped_query || icp.queries[0],
      } as Record<string, unknown> & { _score: number; _breakdown: Record<string, number>; _bucket: 'QUALIFIED' | 'NURTURE' | 'DISCARDED'; _scrapedQuery: string };
    });

    const qualified = scored.filter(l => l._bucket === 'QUALIFIED');
    const nurture = scored.filter(l => l._bucket === 'NURTURE');
    const discarded = scored.filter(l => l._bucket === 'DISCARDED');

    // ── Step 4: Push qualified leads to SendFlow DB ──────────
    const createdLeads = [];
    for (const lead of qualified.slice(0, 30)) {
      try {
        // Normalize phone
        let phone = ((lead.phone as string) || '').replace(/\D/g, '');
        if (phone.length === 10) phone = '233' + phone.slice(1);
        else if (phone.length > 13) phone = phone.slice(0, 13);

        const created = await prisma.lead.create({
          data: {
            userId: session.id,
            name: ((lead.name as string) || 'Unknown').slice(0, 120),
            email: null,
            phone: phone || null,
            company: ((lead.company as string) || ((lead.name as string) || '')) || null,
            stage: 'SCOUTED',
            source: `scout:${lead._scrapedQuery || 'google_maps'}`,
            notes: JSON.stringify({
              originalData: lead._meta,
              score: lead._score,
              breakdown: lead._breakdown,
              scrapedQuery: lead._scrapedQuery,
            }),
          },
        });

        await prisma.leadActivity.create({
          data: {
            leadId: created.id,
            userId: session.id,
            type: 'note',
            content: `🤖 Scouted via ICP engine. Business type: ${businessType}. Target: ${targetCustomer}. Score: ${lead._score}/100. Breakdown: profile=${lead._breakdown.profile}, affluence=${lead._breakdown.affluence}, contact=${lead._breakdown.contact}, intent=${lead._breakdown.intent}.`,
          },
        });

        createdLeads.push(created);
      } catch (err) {
        console.error('[scout] Failed to create lead:', err);
      }
    }

    return NextResponse.json({
      summary: {
        businessType,
        targetCustomer,
        queriesRun: icp.queries,
        totalScraped: rawBusinesses.length,
        qualified: qualified.length,
        nurture: nurture.length,
        discarded: discarded.length,
        pushedTosendflow: createdLeads.length,
      },
      breakdown: {
        qualified: qualified.slice(0, 10).map(l => ({
          name: l.name,
          phone: l.phone,
          address: l.address,
          category: l.category,
          score: l._score,
          breakdown: l._breakdown,
        })),
        nurture: nurture.slice(0, 5).map(l => ({
          name: l.name,
          phone: l.phone,
          score: l._score,
        })),
      },
      createdLeadIds: createdLeads.map(l => l.id),
    }, { status: 201 });
  } catch (err) {
    console.error('[scout] Unhandled error:', err);
    return NextResponse.json({ error: 'Scout failed', detail: String(err) }, { status: 500 });
  }
}