#!/usr/bin/env node
/**
 * SendFlow WhatsApp Campaign Worker
 * Runs on Don's Mac (or any machine with wacli installed)
 * Polls local database for pending campaign messages and sends via wacli
 */
const { createClient } = require('@libsql/client');
const { PrismaClient } = require('@prisma/client');
const { PrismaLibSQL } = require('@prisma/adapter-libsql');
const { execSync } = require('child_process');

const POLL_INTERVAL = 10000; // 10 seconds

// Require API key from environment — fail fast if missing
const API_KEY = process.env.SENDFLOW_API_KEY;
if (!API_KEY) {
  console.error('FATAL: SENDFLOW_API_KEY env var not set');
  process.exit(1);
}

const BASE_URL = process.env.SENDFLOW_API_URL || 'https://sendflow-two.vercel.app';

// Module-level PrismaClient — created once, reused
let prisma;
function getPrisma() {
  if (!prisma) {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      console.error('FATAL: DATABASE_URL env var not set');
      process.exit(1);
    }
    const libsql = createClient({ url: dbUrl });
    const adapter = new PrismaLibSQL(libsql);
    prisma = new PrismaClient({ adapter });
  }
  return prisma;
}

function formatPhone(phone) {
  const clean = (phone || '').replace(/\D/g, '');
  if (clean.startsWith('0')) return `+233${clean.slice(1)}`;
  if (clean.startsWith('233')) return `+${clean}`;
  return `+233${clean}`;
}

function sendWacli(phone, message) {
  const formatted = formatPhone(phone);
  try {
    execSync(`wacli send -n "${formatted}" -m "${message.replace(/"/g, '\\"')}"`, { timeout: 20000 });
    return true;
  } catch (e) {
    console.log(`  WACLI FAILED for ${formatted}: ${e.message}`);
    return false;
  }
}

async function pollAndSend() {
  let db;
  try {
    db = getPrisma();

    const pending = await db.message.findMany({
      where: { status: 'PENDING' },
      include: { campaign: true, contact: true },
      take: 10,
    });

    if (pending.length === 0) return;

    console.log(`[${new Date().toISOString()}] ${pending.length} pending messages`);

    for (const msg of pending) {
      const { contact, campaign, id } = msg;
      const ok = sendWacli(contact.phone, campaign.content);
      await db.message.update({
        where: { id },
        data: {
          status: ok ? 'SENT' : 'FAILED',
          sentAt: ok ? new Date() : undefined,
          failureReason: ok ? undefined : 'wacli send failed',
        },
      });
    }

    // Check if campaign is done
    const campaignId = pending[0].campaignId;
    const stillPending = await db.message.count({ where: { campaignId, status: 'PENDING' } });
    if (stillPending === 0) {
      await db.campaign.update({
        where: { id: campaignId },
        data: { status: 'SENT' },
      });
      console.log(`  Campaign ${campaignId} complete`);
    }
  } catch (e) {
    console.error('Poll error:', e.message);
  } finally {
    if (db) await db.$disconnect();
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Worker shutting down...');
  if (prisma) await prisma.$disconnect();
  process.exit(0);
});

// Start
console.log('SendFlow worker started. Polling every 10s...');
pollAndSend().then(() => {
  setInterval(pollAndSend, POLL_INTERVAL);
}).catch(e => {
  console.error('Fatal worker error:', e);
  process.exit(1);
});