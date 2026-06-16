#!/usr/bin/env node
/**
 * Standalone Lead Discovery Script
 * Runs on VPS as cron job alternative to n8n
 * Usage: node lead-discovery.js --dry-run
 */

const https = require('https');
const querystring = require('querystring');

// ─── CONFIGURATION ───
const CONFIG = {
  googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || '',
  sendflowWebhookUrl: process.env.SENDFLOW_WEBHOOK_URL || 'https://sendflow-two.vercel.app/api/webhooks/n8n/leads',
  sendflowApiKey: process.env.SENDFLOW_API_KEY || '',

  // Search queries per industry + city
  queries: [
    { industry: 'software', city: 'Accra', q: 'software companies in Accra' },
    { industry: 'logistics', city: 'Accra', q: 'logistics companies in Accra' },
    { industry: 'manufacturing', city: 'Tema', q: 'manufacturing companies in Tema' },
    { industry: 'real estate', city: 'Kumasi', q: 'real estate companies in Kumasi' },
    { industry: 'construction', city: 'Accra', q: 'construction companies in Accra' },
    { industry: 'hotel', city: 'Accra', q: 'hotels in Accra' },
    { industry: 'restaurant', city: 'East Legon', q: 'restaurants in East Legon' },
    { industry: 'pharmacy', city: 'Accra', q: 'pharmacies in Accra' },
  ],

  // Scoring thresholds
  minScore: 6,
  maxResultsPerQuery: 20,
  maxLeadsPerRun: 100,

  // Rate limiting (ms between Maps API calls)
  delayMs: 1500,
};

// ─── UTILITIES ───
function log(...args) {
  console.log(`[${new Date().toISOString()}]`, ...args);
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { resolve({ raw: data, statusCode: res.statusCode }); }
      });
    }).on('error', reject);
  });
}

function httpPost(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const postData = JSON.stringify(body);
    const req = https.request({
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        ...headers,
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { resolve({ raw: data, statusCode: res.statusCode }); }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// ─── PHONE NORMALIZATION ───
function normalizePhone(raw) {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('233')) digits = '0' + digits.slice(3);
  if (!digits.startsWith('0') && digits.length === 9) digits = '0' + digits;
  if (digits.length < 10) return null;
  return digits;
}

// ─── RULE-BASED SCORING ───
function scoreLead(lead) {
  let score = 5;
  const types = (lead.types || '').toLowerCase();
  const name = (lead.name || '').toLowerCase();

  if (lead.website) score += 2;
  if (lead.rating && lead.totalRatings > 10) score += 1;

  const competitive = ['restaurant', 'hotel', 'pharmacy', 'store', 'shop', 'travel'];
  if (competitive.some(c => types.includes(c))) score += 1;

  const bizIndicators = ['ltd', 'limited', 'company', 'services', 'enterprise', 'solutions', 'group', 'inc'];
  if (bizIndicators.some(b => name.includes(b))) score += 1;

  const soloIndicators = ['tailor', 'barber', 'hair', 'nails', 'mechanic', 'fitter'];
  if (soloIndicators.some(s => name.includes(s))) score -= 2;

  if (!lead.website && (!lead.totalRatings || lead.totalRatings < 5)) score -= 1;

  return Math.max(1, Math.min(10, score));
}

const PAIN_MAP = {
  software: ['high customer acquisition cost', 'long sales cycles', 'price competition'],
  logistics: ['finding consistent clients', 'pricing pressure', 'fuel cost volatility'],
  manufacturing: ['order fluctuation', 'distribution challenges', 'payment delays'],
  'real estate': ['low buyer volume', 'long listing times', 'commission compression'],
  construction: ['project delays', 'client payment issues', 'material cost rises'],
  hotel: ['low occupancy', 'OTA commission costs', 'seasonal demand'],
  restaurant: ['high competition', 'staff turnover', 'rising food costs'],
};

function getPainPoints(industry) {
  return PAIN_MAP[industry] || ['finding new customers', 'pricing pressure', 'standing out from competitors'];
}

// ─── GOOGLE MAPS API ───
async function searchPlaces(query, apiKey) {
  const params = querystring.stringify({
    query,
    key: apiKey,
    radius: 50000,
  });
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?${params}`;
  const data = await httpGet(url);
  return (data.results || []).slice(0, CONFIG.maxResultsPerQuery);
}

async function getPlaceDetails(placeId, apiKey) {
  const params = querystring.stringify({
    place_id: placeId,
    key: apiKey,
    fields: 'name,formatted_phone_number,website,opening_hours,formatted_address',
  });
  const url = `https://maps.googleapis.com/maps/api/place/details/json?${params}`;
  const data = await httpGet(url);
  return data.result || {};
}

// ─── MAIN PIPELINE ───
async function run({ dryRun = false } = {}) {
  log('🚀 Starting KGC Lead Discovery');
  log(`Dry run: ${dryRun}`);

  if (!CONFIG.googleMapsApiKey) {
    log('❌ Missing GOOGLE_MAPS_API_KEY');
    process.exit(1);
  }
  if (!dryRun && !CONFIG.sendflowApiKey) {
    log('❌ Missing SENDFLOW_API_KEY');
    process.exit(1);
  }

  const allLeads = [];

  for (const { industry, city, q } of CONFIG.queries) {
    log(`🔍 Searching: ${q}`);
    const places = await searchPlaces(q, CONFIG.googleMapsApiKey);
    log(`   Found ${places.length} places`);

    for (const place of places) {
      await sleep(CONFIG.delayMs);

      const detail = await getPlaceDetails(place.place_id, CONFIG.googleMapsApiKey);
      const phone = normalizePhone(detail.formatted_phone_number);
      if (!phone) continue;

      const lead = {
        name: detail.name || place.name,
        phone,
        address: detail.formatted_address || place.formatted_address,
        website: detail.website || '',
        rating: place.rating || null,
        totalRatings: place.user_ratings_total || 0,
        industry,
        city,
        source: `google-maps-${city.toLowerCase().replace(/\s+/g, '-')}`,
        types: place.types?.join(', ') || '',
      };

      lead.score = scoreLead(lead);
      if (lead.score < CONFIG.minScore) continue;

      lead.company_size = lead.website ? '11-50' : '2-10';
      lead.pain_points = getPainPoints(industry).join('; ');
      lead.ai_reasoning = `Rule-based: website=${!!lead.website}, ratings=${lead.totalRatings}, types=${lead.types}`;
      lead.fit_score = String(lead.score);
      lead.has_website = !!lead.website;

      allLeads.push(lead);
      log(`   ✅ ${lead.name} (${lead.phone}) — Score: ${lead.score}`);

      if (allLeads.length >= CONFIG.maxLeadsPerRun) {
        log(`   Reached max leads per run (${CONFIG.maxLeadsPerRun})`);
        break;
      }
    }

    if (allLeads.length >= CONFIG.maxLeadsPerRun) break;
  }

  log(`\n📊 Total qualified leads: ${allLeads.length}`);

  if (allLeads.length === 0) {
    log('No leads found. Exiting.');
    return;
  }

  if (dryRun) {
    log('\n--- DRY RUN OUTPUT ---');
    for (const lead of allLeads) {
      log(JSON.stringify(lead, null, 2));
    }
    log('--- END DRY RUN ---');
    return;
  }

  // Send to SendFlow in batches of 10
  const BATCH_SIZE = 10;
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < allLeads.length; i += BATCH_SIZE) {
    const batch = allLeads.slice(i, i + BATCH_SIZE).map(l => ({
      phone: l.phone,
      name: l.name,
      industry: l.industry,
      city: l.city,
      company_size: l.company_size,
      fit_score: l.fit_score,
      pain_points: l.pain_points,
      ai_reasoning: l.ai_reasoning,
      source: l.source,
      has_website: l.has_website,
      rating: l.rating,
      total_ratings: l.totalRatings,
    }));

    try {
      const res = await httpPost(
        CONFIG.sendflowWebhookUrl,
        { leads: batch },
        { 'x-sendflow-key': CONFIG.sendflowApiKey }
      );

      if (res.success) {
        sent += batch.length;
        log(`   📤 Batch ${i / BATCH_SIZE + 1}: Sent ${batch.length} leads`);
      } else {
        failed += batch.length;
        log(`   ⚠️ Batch ${i / BATCH_SIZE + 1}: Failed — ${JSON.stringify(res)}`);
      }
    } catch (err) {
      failed += batch.length;
      log(`   ❌ Batch ${i / BATCH_SIZE + 1}: Error — ${err.message}`);
    }

    await sleep(2000);
  }

  log(`\n✅ Done. Sent: ${sent}, Failed: ${failed}`);
}

// ─── CLI ───
const dryRun = process.argv.includes('--dry-run');
run({ dryRun }).catch(err => {
  log('Fatal error:', err);
  process.exit(1);
});
