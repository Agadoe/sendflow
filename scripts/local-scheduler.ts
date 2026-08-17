/**
 * Local campaign scheduler — runs on THIS Mac, no VPS, no Vercel cron.
 *
 * Polls Turso for due campaigns and dispatches them through the shared
 * @/lib/campaign-dispatch module (the same module the Vercel dashboard "Send"
 * button uses), so the anti-ban pacing is identical on both paths:
 *   - one message at a time, randomized 4–12s (15–35s every 5th, 30–60s every 10th)
 *   - 20/min + 300/day in-memory caps
 *   - 08:00–20:00 business-hours gate (user timezone)
 *   - opt-in skip, 7-day duplicate skip, greeting spin
 *
 * A "due" campaign is either:
 *   - status SCHEDULED with scheduledAt <= now  (time to fire), or
 *   - status SENDING with PENDING messages left (stranded mid-send — resume)
 *
 * Run modes (env):
 *   DRY_RUN=1     Resolve + preview cadence and recipients, send/write NOTHING.
 *   RUN_ONCE=1    Do a single pass and exit (use for verification). Otherwise loops.
 *   POLL_INTERVAL_MS  Tick interval (default 30000).
 *   WACLI_DAEMON_URL  Forced to http://localhost:4555 below (the local daemon).
 *
 * Graceful: SIGTERM/SIGINT aborts the in-flight dispatch after the current
 * message and exits cleanly.
 *
 * Usage:
 *   npx tsx scripts/local-scheduler.ts              # live, loops
 *   DRY_RUN=1 RUN_ONCE=1 npx tsx scripts/local-scheduler.ts   # verify, one pass
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// ── 1. Load .env.local (TURSO_DATABASE_URL etc.) — manual, dotenv-free ──
const __dirname = dirname(fileURLToPath(import.meta.url));
try {
  for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(?:"([^"]*)"|(.+?))\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2] ?? m[3] ?? '';
  }
} catch (e) {
  console.error('[scheduler] WARNING: could not load .env.local:', (e as Error).message);
}

// ── 2. Force the LOCAL daemon (everything runs on macOS — no Vercel/ngrok/VPS) ─
// Must be set BEFORE importing @/lib/daemon-fetch, which captures
// WACLI_DAEMON_URL at module load. (The Vercel deploy's ngrok URL never
// applies to this process.)
process.env.WACLI_DAEMON_URL = 'http://localhost:4555';

const DRY_RUN = !!process.env.DRY_RUN;
const RUN_ONCE = !!process.env.RUN_ONCE;
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || '30000', 10);
// Conservative anti-ban session cap (revised 2026-08-17 after WhatsApp forced a
// LOGOUT on a continuous 208-send run): send at most SESSION_MAX per campaign
// per tick, then enforce SESSION_COOLDOWN_MS before the next session. Defaults:
// 20/session, 2h between sessions. With 45-120s pacing that's ~8 sessions for
// the remaining ~159 contacts, spread over ~2 days inside 08-20 business hours.
const SESSION_MAX = parseInt(process.env.SESSION_MAX || '20', 10);
const SESSION_COOLDOWN_MS = parseInt(process.env.SESSION_COOLDOWN_MS || '7200000', 10);

function ts(): string {
  return new Date().toISOString();
}

async function main() {
  // Import AFTER env is set so daemon-fetch picks up localhost:4555.
  const { prisma } = await import('@/lib/prisma');
  const { dispatchCampaign, sleep, getHumanDelay } = await import('@/lib/campaign-dispatch');

  const controller = new AbortController();
  let stopping = false;
  const shutdown = (sig: string) => {
    if (stopping) return;
    stopping = true;
    console.log(`\n[scheduler] ${sig} received — finishing current message, then exiting.`);
    controller.abort();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  console.log(`[scheduler ${ts()}] starting — DRY_RUN=${DRY_RUN} RUN_ONCE=${RUN_ONCE} poll=${POLL_INTERVAL_MS}ms sessionMax=${SESSION_MAX} sessionCooldown=${SESSION_COOLDOWN_MS}ms daemon=${process.env.WACLI_DAEMON_URL}`);

  // In-memory per-campaign session cooldown (campaignId → next-eligible ms).
  // Resets on restart, so a restart within the cooldown could trigger one extra
  // session — acceptable given the 20/session cap.
  const sessionCooldown = new Map<string, number>();

  let isRunning = false;

  const tick = async () => {
    if (isRunning) return; // never overlap ticks
    isRunning = true;
    try {
      const now = new Date();
      const nowMs = Date.now();

      const dueScheduled = await prisma.campaign.findMany({
        where: { status: 'SCHEDULED', scheduledAt: { lte: now } },
        select: { id: true, name: true, userId: true, scheduledAt: true, channel: true },
        orderBy: { scheduledAt: 'asc' },
      });

      // Stranded SENDING campaigns that still have PENDING messages (resume),
      // excluding any mid-cooldown from a prior session this run.
      const sending = await prisma.campaign.findMany({
        where: { status: 'SENDING' },
        select: { id: true, name: true, userId: true, scheduledAt: true, channel: true, _count: { select: { messages: { where: { status: 'PENDING' } } } } },
      });
      const stranded = sending
        .filter((c) => c._count.messages > 0)
        .filter((c) => !sessionCooldown.has(c.id) || (sessionCooldown.get(c.id) as number) <= nowMs)
        .map(({ _count, ...c }) => c);
      const coolingDown = sending
        .filter((c) => c._count.messages > 0 && sessionCooldown.has(c.id) && (sessionCooldown.get(c.id) as number) > nowMs);

      const due = [...dueScheduled, ...stranded];
      if (due.length === 0) {
        if (coolingDown.length > 0) {
          const next = Math.min(...coolingDown.map((c) => sessionCooldown.get(c.id) as number));
          const mins = Math.round((next - nowMs) / 60000);
          console.log(`[scheduler ${ts()}] idle — ${coolingDown.length} campaign(s) in session cooldown (next in ~${mins}min).`);
        } else if (RUN_ONCE) {
          console.log(`[scheduler ${ts()}] no due campaigns.`);
        }
        return;
      }

      console.log(`[scheduler ${ts()}] ${due.length} due campaign(s): ${due.map((c) => `"${c.name}"`).join(', ')}`);

      // Sequential — one campaign at a time, one message at a time within it.
      for (const camp of due) {
        if (controller.signal.aborted) break;

        console.log(`\n[scheduler ${ts()}] → campaign "${camp.name}" (${camp.id}) user=${camp.userId} channel=${camp.channel || 'whatsapp'} ${DRY_RUN ? '[DRY RUN]' : '[LIVE]'}`);
        // SMS has no ban risk (paid carrier channel), so it sends the whole
        // campaign in one pass — no 20/session cap or 2h cooldown. WhatsApp
        // stays capped at SESSION_MAX per session with SESSION_COOLDOWN_MS.
        const isSms = (camp.channel || 'whatsapp') === 'sms';
        const batchSize = isSms ? 100000 : SESSION_MAX;
        let pass = 0;
        let campaignSentSomething = false;
        // One session per campaign per tick: dispatchCampaign processes up to
        // batchSize PENDING recipients. WhatsApp then sets a session cooldown
        // and stops (the next session runs after SESSION_COOLDOWN_MS). SMS
        // processes everything in one pass and finishes. Rate-limited /
        // outside-business-hours also stop here and retry on a later tick.
        while (!controller.signal.aborted) {
          pass++;
          let result;
          try {
            result = await dispatchCampaign(
              {
                campaignId: camp.id,
                userId: camp.userId,
                batchSize,
                dryRun: DRY_RUN,
                signal: controller.signal,
                onProgress: (info) => {
                  const delayS = (info.delayMs / 1000).toFixed(1);
                  const tag = info.status === 'WOULD_SEND' ? 'WOULD SEND'
                    : info.status === 'SKIPPED' ? `SKIP (${info.reason})`
                    : info.status === 'FAILED' ? `FAIL (${info.reason})`
                    : info.status;
                  console.log(`    [${info.index + 1}/${info.total}] ${tag} → ${info.phone} (delay ${delayS}s) "${info.preview}"`);
                },
              },
            );
          } catch (e: any) {
            console.error(`[scheduler ${ts()}]   dispatch threw: ${e.message}`);
            break; // stop this campaign, move on
          }

          if (result.sent > 0 || result.wouldSend > 0) campaignSentSomething = true;

          if (result.error && result.outsideBusinessHours) {
            console.log(`[scheduler ${ts()}]   outside business hours — will retry next tick. (${result.error})`);
            break;
          }
          if (result.error && result.rateLimited) {
            console.log(`[scheduler ${ts()}]   rate limited — will resume next tick. (${result.error})`);
            break;
          }
          if (result.error) {
            console.log(`[scheduler ${ts()}]   not dispatched: ${result.error}`);
            break;
          }

          console.log(`[scheduler ${ts()}]   pass ${pass}: ${DRY_RUN ? `wouldSend=${result.wouldSend}` : `sent=${result.sent}`} skipped=${result.skipped} failed=${result.failed} remaining=${result.remaining} total=${result.total} done=${result.done}`);

          if (result.done || result.remaining === 0) break;
          if (controller.signal.aborted) break;
          // WhatsApp session cap reached: enforce the cooldown before the next
          // session. SMS has no ban risk, so it never sets a cooldown — if a pass
          // is interrupted (remaining>0), the next tick retries immediately.
          if (!isSms && !DRY_RUN && (result.sent > 0 || result.wouldSend > 0)) {
            sessionCooldown.set(camp.id, Date.now() + SESSION_COOLDOWN_MS);
            const hrs = (SESSION_COOLDOWN_MS / 3600000).toFixed(1);
            console.log(`[scheduler ${ts()}]   session cap hit: ${result.sent} sent, ${result.remaining} remaining — pausing ${hrs}h before the next session.`);
          }
          break; // one session per tick; cooldown (or done) gates the next
        }

        // Human-like pause between campaigns ONLY if this one actually sent
        // (a person pauses between real broadcasts, not between empty no-ops).
        if (!controller.signal.aborted && !DRY_RUN && campaignSentSomething) {
          const inter = 20000 + Math.floor(Math.random() * 20000);
          console.log(`[scheduler ${ts()}]   pausing ${(inter / 1000).toFixed(0)}s before next campaign…`);
          await sleep(inter);
        }
      }
    } catch (e: any) {
      console.error(`[scheduler ${ts()}] tick error:`, e?.stack || e?.message || e);
    } finally {
      isRunning = false;
    }
  };

  if (RUN_ONCE) {
    await tick();
    console.log(`\n[scheduler ${ts()}] RUN_ONCE complete — exiting.`);
    await prisma.$disconnect();
    process.exit(0);
  }

  await tick();
  const timer = setInterval(tick, POLL_INTERVAL_MS);
  // Keep the event loop alive while idle.
  const keepAlive = setInterval(() => {}, 1 << 30);
  process.on('exit', () => { clearInterval(timer); clearInterval(keepAlive); });
}

main().catch((e) => {
  console.error('[scheduler] fatal:', e?.stack || e?.message || e);
  process.exit(1);
});