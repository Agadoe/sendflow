generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["driverAdapters"]
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  name          String
  phone         String?
  plan          String    @default("FREE")
  passwordHash  String?
  emailVerified DateTime?
  isOwner       Boolean   @default(false)
  role          String    @default("CLIENT") // ADMIN | CLIENT
  timezone      String    @default("UTC")
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  // Multi-tenant wacli session fields
  wacliSessionId       String? // Unique identifier for this user's wacli session
  wacliStatus          String? // DISCONNECTED | QR_READY | AUTHENTICATED | ERROR
  wacliPhone           String? // WhatsApp phone number once connected
  wacliLastConnectedAt DateTime? // Timestamp of last successful connection
  wacliQrCode          String? // Transient QR code for re-display during auth flow

  campaigns             Campaign[]
  contacts              Contact[]
  payments              Payment[]
  apiKeys               ApiKey[]
  sessions              Session[]
  accounts              Account[]
  automations           Automation[]
  leads                 Lead[]
  leadActivities        LeadActivity[]
  teamMembers           TeamMember[]
  clickToWhatsAppLinks  ClickToWhatsAppLink[]
  whatsAppForms         WhatsAppForm[]
  leadAttribution       LeadAttribution?
  dripScheduledMessages DripScheduledMessage[]
  OutboundMessage       OutboundMessage[]
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}

model Campaign {
  id          String    @id @default(cuid())
  userId      String
  name        String
  content     String
  mediaUrl    String?
  status      String    @default("DRAFT")
  scheduledAt DateTime?
  sentAt      DateTime?
  recurrence  String? // DAILY | WEEKLY | MONTHLY | null
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  user     User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  messages Message[]
}

model Message {
  id            String    @id @default(cuid())
  campaignId    String
  contactId     String
  status        String    @default("PENDING")
  sentAt        DateTime?
  deliveredAt   DateTime?
  failedAt      DateTime?
  failureReason String?
  createdAt     DateTime  @default(now())

  campaign Campaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  contact  Contact  @relation(fields: [contactId], references: [id], onDelete: Cascade)
}

model Contact {
  id        String   @id @default(cuid())
  userId    String
  phone     String
  name      String?
  tags      String   @default("[]")
  createdAt DateTime @default(now())

  // WhatsApp opt-in compliance
  optedIn     Boolean   @default(false)
  optedInAt   DateTime?
  optedInSource String? // e.g. "website-signup", "manual-import"

  // Anti-spam / duplicate detection
  lastMessageContent String?
  lastMessageSentAt  DateTime?

  user                  User                   @relation(fields: [userId], references: [id], onDelete: Cascade)
  messages              Message[]
  dripScheduledMessages DripScheduledMessage[]
}

model Payment {
  id        String   @id @default(cuid())
  userId    String
  amount    Int
  plan      String
  status    String   @default("PENDING")
  ref       String?  @unique
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model Waitlist {
  id           String   @id @default(cuid())
  email        String   @unique
  name         String
  businessType String?
  phone        String?
  wantsCall    Boolean  @default(false)
  createdAt    DateTime @default(now())

  submissions WaitlistSubmission[]
}

// Permanent submission audit log — survives Mailchimp failures and lets us
// backfill or re-sync without losing data. Email + phone uniqueness is
// enforced at the application layer because the same person may submit with
// different emails but the same phone (or vice versa).
model WaitlistSubmission {
  id                String    @id @default(cuid())
  waitlistId        String?
  email             String
  name              String
  phone             String
  phoneE164         String
  businessType      String?
  wantsCall         Boolean   @default(false)
  source            String    @default("landing") // landing | telegram | api
  ip                String?
  userAgent         String?
  // Sync status across destinations
  mailchimpStatus   String    @default("pending") // pending | synced | failed
  mailchimpError    String?
  mailchimpSyncedAt DateTime?
  telegramStatus    String    @default("pending") // pending | synced | failed | skipped
  telegramError     String?
  telegramSyncedAt  DateTime?
  createdAt         DateTime  @default(now())

  waitlist Waitlist? @relation(fields: [waitlistId], references: [id], onDelete: SetNull)

  @@index([email])
  @@index([phone])
  @@index([createdAt])
}

model ApiKey {
  id        String    @id @default(cuid())
  userId    String
  name      String    @default("API Key")
  key       String    @unique
  lastUsed  DateTime?
  createdAt DateTime  @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model Automation {
  id            String    @id @default(cuid())
  userId        String
  name          String
  description   String?
  trigger       String
  triggerConfig String    @default("{}")
  conditions    String    @default("[]")
  actions       String    @default("[]")
  isEnabled     Boolean   @default(true)
  lastTriggered DateTime?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  user         User                   @relation(fields: [userId], references: [id], onDelete: Cascade)
  executions   AutomationExecution[]
  dripMessages DripScheduledMessage[]
}

model AutomationExecution {
  id           String   @id @default(cuid())
  automationId String
  contactId    String?
  event        String
  payload      String?
  executedAt   DateTime @default(now())

  automation Automation @relation(fields: [automationId], references: [id], onDelete: Cascade)
}

model LeadActivity {
  id        String   @id @default(cuid())
  leadId    String
  userId    String
  type      String // note | call | email | whatsapp | stage_change | score_update | enrichment
  content   String
  metadata  String   @default("{}") // JSON — holds extra context (duration, channel, etc.)
  createdAt DateTime @default(now())

  lead Lead @relation(fields: [leadId], references: [id], onDelete: Cascade)
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

// Tracks every outbound message sent to a lead via any channel
model OutboundMessage {
  id            String    @id @default(cuid())
  leadId        String
  userId        String
  channel       String // whatsapp | email | sms | telegram
  content       String // The message sent
  status        String    @default("PENDING") // PENDING | SENT | DELIVERED | READ | REPLIED | FAILED | BOUNCED
  sentAt        DateTime?
  deliveredAt   DateTime?
  readAt        DateTime?
  repliedAt     DateTime?
  failureReason String?
  externalId    String? // Provider message ID (WhatsApp message ID, email Message-ID, etc.)
  metadata      String    @default("{}") // JSON — provider response, media URLs, etc.
  createdAt     DateTime  @default(now())

  lead Lead @relation(fields: [leadId], references: [id], onDelete: Cascade)
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model Lead {
  id                String    @id @default(cuid())
  userId            String
  name              String
  email             String?
  phone             String?
  company           String?
  stage             String    @default("SCOUTED") // SCOUTED | QUALIFIED | CONTACTED | PROPOSAL | NEGOTIATING | CONVERTED | CLOSED
  source            String?
  notes             String    @default("[]") // JSON array of note objects [{text, author, createdAt}]
  nextFollowUp      DateTime?
  // CRM fields
  score             Int       @default(0) // 0-100 ICP score from scout engine
  scoreBreakdown    String    @default("{}") // JSON {profile, affluence, contact, intent}
  dealValue         Int? // Estimated deal value in Ghana Cedis
  contactCount      Int       @default(0) // Number of outreach touches
  lastContactedAt   DateTime?
  convertedAt       DateTime?
  convertedValue    Int? // Actual closed deal value
  tags              String    @default("[]") // JSON array ["hot", "follow-up", "referral"]
  // Enrichment fields (populated by enrichment step)
  jobTitle          String?
  industry          String?
  linkedinUrl       String?
  website           String?
  address           String?
  // ICP context — saved from scout request for audit
  icpBusinessType   String?
  icpTargetCustomer String?
  // Outreach tracking
  outreachStatus    String    @default("PENDING") // PENDING | SENT | DELIVERED | REPLIED | CONVERTED | FAILED
  lastOutreachAt    DateTime?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  user            User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  activities      LeadActivity[]
  OutboundMessage OutboundMessage[]
}

model TeamMember {
  id        String    @id @default(cuid())
  userId    String
  email     String
  role      String    @default("EDITOR") // ADMIN | EDITOR | VIEWER
  invitedBy String?
  token     String? // magic invite token
  invitedAt DateTime  @default(now())
  joinedAt  DateTime?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model ClickToWhatsAppLink {
  id          String   @id @default(cuid())
  userId      String
  name        String
  phone       String
  prefillMsg  String?
  utmSource   String?
  utmMedium   String?
  utmCampaign String?
  createdAt   DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model WhatsAppForm {
  id         String   @id @default(cuid())
  userId     String
  name       String
  phone      String
  prefillMsg String?
  questions  String   @default("[]") // [{ question, field, required }]
  tagName    String?
  tagValue   String?
  isActive   Boolean  @default(true)
  createdAt  DateTime @default(now())

  user        User                     @relation(fields: [userId], references: [id], onDelete: Cascade)
  submissions WhatsAppFormSubmission[]
}

model WhatsAppFormSubmission {
  id        String   @id @default(cuid())
  formId    String
  phone     String
  answers   String   @default("{}") // { field: answer }
  createdAt DateTime @default(now())

  form WhatsAppForm @relation(fields: [formId], references: [id], onDelete: Cascade)
}

// Drip messaging: messages scheduled for future delivery
model DripScheduledMessage {
  id            String    @id @default(cuid())
  userId        String
  contactId     String
  automationId  String? // which automation triggered this (optional)
  channel       String    @default("whatsapp") // whatsapp | email | sms
  template      String // message content
  scheduledFor  DateTime // when to send
  status        String    @default("PENDING") // PENDING | SENT | FAILED | CANCELLED
  sentAt        DateTime?
  failureReason String?
  sequenceOrder Int       @default(0) // order within the drip sequence
  createdAt     DateTime  @default(now())

  user       User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  contact    Contact     @relation(fields: [contactId], references: [id], onDelete: Cascade)
  automation Automation? @relation(fields: [automationId], references: [id], onDelete: SetNull)
}

model ContactMessage {
  id         String    @id @default(cuid())
  name       String
  email      String
  phone      String?
  subject    String?
  message    String
  ip         String?
  userAgent  String?
  read       Boolean   @default(false)
  readAt     DateTime?
  readBy     String?
  // Whether the notification email was sent successfully
  emailSent  Boolean   @default(false)
  emailError String?
  createdAt  DateTime  @default(now())

  @@index([createdAt])
  @@index([read])
}

// InboundEmail — IMAP inbox mirror for sendflow@baahe.org.
// Polled by /api/cron/fetch-mail (Vercel cron).
// See prisma/migrations/20260606_inbound_email_inbox/migration.sql
model InboundEmail {
  id               String    @id @default(cuid())
  uid              Int
  mailbox          String    @default("INBOX")
  messageId        String?
  fromAddress      String
  fromName         String?
  toAddress        String
  cc               String?
  subject          String?
  sentAt           DateTime?
  receivedAt       DateTime?
  textBody         String?
  htmlBody         String?
  snippet          String    @default("")
  attachments      String? // JSON array
  read             Boolean   @default(false)
  readAt           DateTime?
  readBy           String?
  matchedContactId String?
  fetchedAt        DateTime  @default(now())

  @@unique([mailbox, uid])
  @@index([receivedAt])
  @@index([fromAddress])
  @@index([read])
  @@index([messageId])
}

// Lead attribution — persists UTM and referral params from registration URL.
// Written once at account creation; read-only after (shown on dashboard).
model LeadAttribution {
  id         String   @id @default(cuid())
  userId     String   @unique // one attribution record per user
  source     String? // utm_source: e.g. "telegram", "jiji", "jiji.com.gh", "google", "baahee_bot"
  medium     String? // utm_medium: e.g. "referral", "cpc", "organic", "cta_button"
  campaign   String? // utm_campaign: e.g. "sendflow-waitlist", "malejor-q2"
  ref        String? // ?ref= param: e.g. "leadops", "bot", "wa_cta"
  referrer   String? // raw HTTP Referer header
  landingUrl String? // first page they visited
  createdAt  DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}


===================================
FILE: src/middleware.ts
===================================

import { getJWTSecret } from '@/lib/jwt';
import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';


const PUBLIC_PATHS = [
  '/',
  '/login',
  '/register',
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/verify',
  '/api/auth/magic-link',
  '/api/waitlist',
  '/client-portal/login',
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public paths (including Next.js internals)
  if (
    PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith('/_next'))
  ) {
    return NextResponse.next();
  }

  // Allow client-auth API routes without auth
  if (pathname.startsWith('/api/client-auth')) {
    return NextResponse.next();
  }

  // Client portal: require CLIENT role
  if (pathname.startsWith('/client-portal')) {
    const token = req.cookies.get('sf_token')?.value;
    if (!token) {
      return NextResponse.redirect(new URL('/client-portal/login', req.url));
    }

    try {
      const { payload } = await jwtVerify(token, getJWTSecret());
      if (payload.role !== 'CLIENT') {
        return NextResponse.redirect(new URL('/client-portal/login', req.url));
      }
      // Attach user info to headers for server components
      const requestHeaders = new Headers(req.headers);
      requestHeaders.set('x-user-id', payload.sub as string);
      requestHeaders.set('x-user-role', payload.role as string);
      return NextResponse.next({ request: { headers: requestHeaders } });
    } catch {
      const response = NextResponse.redirect(new URL('/client-portal/login', req.url));
      response.cookies.delete('sf_token');
      return response;
    }
  }

  // Admin dashboard: require valid token (role ADMIN or CLIENT both ok)
  if (pathname.startsWith('/dashboard')) {
    const token = req.cookies.get('sf_token')?.value;
    if (!token) {
      const loginUrl = new URL('/login', req.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }

    try {
      const { payload } = await jwtVerify(token, getJWTSecret());
      if (payload.role === 'CLIENT') {
        // CLIENTs should not access the admin dashboard
        const loginUrl = new URL('/client-portal', req.url);
        return NextResponse.redirect(loginUrl);
      }
      return NextResponse.next();
    } catch {
      const loginUrl = new URL('/login', req.url);
      loginUrl.searchParams.set('redirect', pathname);
      const response = NextResponse.redirect(loginUrl);
      response.cookies.delete('sf_token');
      return response;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/client-portal/:path*'],
};

===================================
FILE: src/lib/auth.ts
===================================

import { getJWTSecret } from '@/lib/jwt';
import { jwtVerify, SignJWT } from 'jose';
import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';


export interface SessionUser {
  id: string;
  email: string;
  name: string;
  plan: string;
  role: 'ADMIN' | 'EDITOR' | 'VIEWER' | 'OWNER';
  isOwner: boolean;
  timezone?: string | null;
}

function buildSession(user: {
  id: string;
  email: string;
  name: string;
  plan: string;
  isOwner: boolean;
  role?: string | null;
  timezone?: string | null;
}): SessionUser {
  const role = user.isOwner
    ? 'OWNER'
    : (user.role as SessionUser['role']) || 'VIEWER';
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    plan: user.plan,
    role,
    isOwner: user.isOwner,
    timezone: user.timezone,
  };
}
/**
 * Extract and verify the sf_token cookie, returning the session user with role.
 */
export async function getSession(req: NextRequest): Promise<SessionUser | null> {
  const token = req.cookies.get('sf_token')?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getJWTSecret());
    const userId = payload.sub as string;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, plan: true, isOwner: true, role: true },
    });

    if (!user) return null;

    return buildSession(user);
  } catch {
    return null;
  }
}

/**
 * Require a valid session — throws a 401 JSON response if not authenticated.
 */
export async function requireSession(req: NextRequest): Promise<SessionUser> {
  const session = await getSession(req);
  if (!session) {
    throw new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return session;
}

/**
 * Role-hierarchy check: OWNER > ADMIN > EDITOR > VIEWER
 */
export function hasRole(session: SessionUser, minRole: SessionUser['role']): boolean {
  const hierarchy: SessionUser['role'][] = ['VIEWER', 'EDITOR', 'ADMIN', 'OWNER'];
  return hierarchy.indexOf(session.role) >= hierarchy.indexOf(minRole);
}

/**
 * Guard: require minimum role level. Throws 403 if insufficient.
 */
export async function requireRole(req: NextRequest, minRole: SessionUser['role']): Promise<SessionUser> {
  const session = await requireSession(req);
  if (!hasRole(session, minRole)) {
    throw new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return session;
}

/**
 * Convenience: read the session from the current request's cookies via
 * next/headers. Use this in route handlers that don't already receive a
 * NextRequest. Returns null if no valid session.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('sf_token')?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getJWTSecret());
    const userId = payload.sub as string;
    if (!userId) return null;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, plan: true, isOwner: true, role: true, timezone: true },
    });
    if (!user) return null;

    return buildSession(user);
  } catch {
    return null;
  }
}

===================================
FILE: src/lib/plans.ts
===================================

/**
 * Plan enforcement — single source of truth for feature limits.
 * Import `requirePlan` in any route that needs paid-tier access.
 */

export type PlanCode = 'FREE' | 'STARTER' | 'GROWTH' | 'PRO';

export interface PlanLimits {
  maxContacts: number;
  maxCampaignsPerMonth: number;
  bulkSend: boolean;
  maxTeamMembers: number;
  maxForms: number;
  apiKeyAccess: boolean;
  dripMessaging: boolean;
  analytics: boolean;
  whiteLabel: boolean;
}

/** Single source of truth for all plan limits. */
export const PLANS: Record<PlanCode, PlanLimits> = {
  FREE: {
    maxContacts: 100,
    maxCampaignsPerMonth: 10,
    bulkSend: true,
    maxTeamMembers: 1,
    maxForms: 1,
    apiKeyAccess: false,
    dripMessaging: false,
    analytics: false,
    whiteLabel: false,
  },
  STARTER: {
    maxContacts: 2_000,
    maxCampaignsPerMonth: 10,
    bulkSend: true,
    maxTeamMembers: 2,
    maxForms: 5,
    apiKeyAccess: true,
    dripMessaging: true,
    analytics: true,
    whiteLabel: false,
  },
  GROWTH: {
    maxContacts: 10_000,
    maxCampaignsPerMonth: 50,
    bulkSend: true,
    maxTeamMembers: 5,
    maxForms: 20,
    apiKeyAccess: true,
    dripMessaging: true,
    analytics: true,
    whiteLabel: false,
  },
  PRO: {
    maxContacts: 50_000,
    maxCampaignsPerMonth: Infinity,
    bulkSend: true,
    maxTeamMembers: 10,
    maxForms: Infinity,
    apiKeyAccess: true,
    dripMessaging: true,
    analytics: true,
    whiteLabel: true,
  },
};

export const PLAN_ORDER: PlanCode[] = ['FREE', 'STARTER', 'GROWTH', 'PRO'];

/** Returns true if `userPlan` is at or above `required`. */
export function hasPlan(userPlan: string, required: PlanCode): boolean {
  const userIdx = PLAN_ORDER.indexOf(userPlan as PlanCode);
  const requiredIdx = PLAN_ORDER.indexOf(required);
  if (userIdx < 0 || requiredIdx < 0) return false;
  return userIdx >= requiredIdx;
}

/** Throw a 403 if the user is on a plan that doesn't support a feature. */
export function requirePlan(userPlan: string, feature: keyof PlanLimits, detail?: string) {
  const limits = PLANS[userPlan as PlanCode] ?? PLANS.FREE;
  if (!limits[feature]) {
    const msg = detail
      ? `${detail} — requires a paid plan.`
      : `This feature requires a paid plan. Please upgrade at /subscribe.`;
    throw { status: 403, message: msg };
  }
}

/** Check contact count limit. Returns the overage (0 = within limit). */
export async function checkContactLimit(
  userId: string,
  incomingCount: number,
  prisma: any
): Promise<number> {
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true },
  });
  const planCode: PlanCode = (row?.plan as PlanCode) ?? 'FREE';

  const max = PLANS[planCode]?.maxContacts ?? 100;
  const current = await prisma.contact.count({ where: { userId } });
  const totalAfterAdd = current + incomingCount;
  if (totalAfterAdd > max) {
    return totalAfterAdd - max; // returns overage
  }
  return 0;
}

/** Check monthly campaign count limit. Returns true if user can create a campaign. */
export async function checkCampaignLimit(userId: string, prisma: any): Promise<boolean> {
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true },
  });
  const planCode: PlanCode = (row?.plan as PlanCode) ?? 'FREE';

  const max = PLANS[planCode]?.maxCampaignsPerMonth ?? 0;
  if (max === 0) return false;
  if (max === Infinity) return true;

  // Count campaigns created this month
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const count = await prisma.campaign.count({
    where: {
      userId,
      createdAt: { gte: startOfMonth },
    },
  });

  return count < max;
}// timestamp: 1781643884


===================================
FILE: src/lib/jwt.ts
===================================

/**
 * Centralized JWT secret for the SendFlow auth system.
 *
 * Throws at **runtime** if JWT_SECRET or NEXTAUTH_SECRET is missing.
 * This allows `next build` to complete without env vars, while ensuring
 * the app refuses to serve requests in production without a real secret.
 *
 * Usage:
 *   import { getJWTSecret } from '@/lib/jwt';
 *   await jwtVerify(token, getJWTSecret());
 *   await new SignJWT(payload).sign(getJWTSecret());
 */

let _secret: Uint8Array | null = null;

export function getJWTSecret(): Uint8Array {
  if (_secret) return _secret;

  const raw = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET;
  if (!raw) {
    throw new Error(
      'JWT_SECRET or NEXTAUTH_SECRET must be set in environment variables. ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  _secret = new TextEncoder().encode(raw);
  return _secret;
}

// Backwards-compatible re-export for files that destructure { getJWTSecret }
export { getJWTSecret as JWT_SECRET };


===================================
FILE: src/lib/prisma.ts
===================================

import { PrismaClient } from '@prisma/client';
import { PrismaLibSQL } from '@prisma/adapter-libsql';
import { createClient } from '@libsql/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

function createPrismaClient() {
  const rawUrl = process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL || 'file:./dev.db';
  // Strip any whitespace/newlines that may surround the URL
  const dbUrl = rawUrl.trim();
  const libsql = createClient({ url: dbUrl });
  const adapter = new PrismaLibSQL(libsql);
  return new PrismaClient({ adapter } as any);
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

===================================
FILE: src/lib/rate-limit.ts
===================================

/**
 * In-memory rate limiter for serverless auth endpoints.
 *
 * Why in-memory: zero dependencies, zero env vars, zero latency.
 * Why it's safe enough: Vercel functions are warm per-region; even if a
 * user's requests land on different instances, they're slowed enough to
 * make credential-stuffing uneconomical. For higher-traffic production,
 * swap `store` for Upstash/Redis (see TODO at bottom).
 *
 * Limits: 5 attempts per 60s per IP+endpoint, sliding window.
 */

type Bucket = { count: number; resetAt: number };
const store = new Map<string, Bucket>();

// Sweep expired entries every 5 min to prevent memory bloat in long-lived
// serverless instances. Safe to call repeatedly — it's a no-op if empty.
function sweep() {
  const now = Date.now();
  store.forEach((v, k) => {
    if (v.resetAt < now) store.delete(k);
  });
}

export interface RateLimitConfig {
  /** Max requests in the window. */
  max: number;
  /** Window length in seconds. */
  windowSec: number;
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetInSec: number;
}

export function checkRateLimit(
  key: string,
  cfg: RateLimitConfig = { max: 5, windowSec: 60 }
): RateLimitResult {
  sweep();
  const now = Date.now();
  const bucket = store.get(key);

  if (!bucket || bucket.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + cfg.windowSec * 1000 });
    return { ok: true, remaining: cfg.max - 1, resetInSec: cfg.windowSec };
  }

  if (bucket.count >= cfg.max) {
    return {
      ok: false,
      remaining: 0,
      resetInSec: Math.ceil((bucket.resetAt - now) / 1000),
    };
  }

  bucket.count++;
  return {
    ok: true,
    remaining: cfg.max - bucket.count,
    resetInSec: Math.ceil((bucket.resetAt - now) / 1000),
  };
}

/**
 * Extracts a client identifier for rate-limit bucketing.
 * Uses x-forwarded-for (Vercel sets this) and falls back to a constant
 * for direct connections (rare in production).
 */
export function clientKey(req: Request, route: string): string {
  const fwd = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ip = fwd || req.headers.get('x-real-ip') || 'unknown';
  return `${route}:${ip}`;
}

// TODO: replace `store` with Upstash Redis for multi-instance production.
// import { Redis } from '@upstash/redis';
// const redis = Redis.fromEnv();
// Use INCR with EXPIRE for an atomic counter, or a sliding-window log.


===================================
FILE: src/lib/email.ts
===================================

/**
 * SendFlow email client — Resend for production, nodemailer for local dev.
 *
 * Production path (RESEND_API_KEY set): uses Resend API (bypasses Vercel
 * serverless SMTP restrictions). Free tier = 100 emails/day.
 *
 * Local/dev path (no RESEND_API_KEY): falls back to nodemailer + baahe.org
 * cPanel SMTP (the original behaviour).
 *
 * Used by /api/auth/magic-link, /api/contact, /api/kgc-contact, and (soon)
 * the waitlist drip + email-verification flow.
 *
 * Env vars:
 *   RESEND_API_KEY        — Resend API key (production, Resend free tier)
 *   SMTP_HOST             — nodemailer fallback: default mail.baahe.org
 *   SMTP_PORT             — nodemailer fallback: default 465
 *   SMTP_SECURE           — nodemailer fallback: default true
 *   SMTP_USER             — nodemailer fallback: default sendflow@baahe.org
 *   SMTP_PASS             — nodemailer fallback: required in production
 *   FROM_NAME             — default: "SendFlow"
 *   FROM_EMAIL            — default: sendflow@baahe.org
 *
 * Test rule: every test email routes to Tedymiles7@gmail.com first.
 */

import nodemailer from 'nodemailer';

// ── Resend (production) ───────────────────────────────────────────────────────
import { Resend } from 'resend';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

// ── nodemailer (local dev fallback) ──────────────────────────────────────────
const SMTP_HOST = process.env.SMTP_HOST || 'mail.baahe.org';
const SMTP_PORT = Number(process.env.SMTP_PORT || 465);
const SMTP_SECURE = process.env.SMTP_SECURE !== 'false'; // default true
const _rawUser = process.env.SMTP_USER || 'sendflow@baahe.org';
const _rawPass = process.env.SMTP_PASS || '';
const SMTP_USER = _rawUser.replace(/\\n$/, '').trim();
const SMTP_PASS = _rawPass.replace(/\\n$/, '').trim();

let cachedTransporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (cachedTransporter) return cachedTransporter;
  cachedTransporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    tls: { rejectUnauthorized: true },
  });
  return cachedTransporter;
}

// ── Shared config ────────────────────────────────────────────────────────────
const FROM_NAME = process.env.FROM_NAME || 'SendFlow';
const FROM_EMAIL = (process.env.FROM_EMAIL || 'sendflow@baahe.org').replace(/\\n$/, '').trim();

// Don's catch-all inbox for tests / verifications. All SendFlow email flows
// MUST land here first; production recipients only after manual sign-off.
export const APPROVAL_INBOX = 'Tedymiles7@gmail.com';

export interface SendMailOptions {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  replyTo?: string;
  /** If true, rewrite `to` to the approval inbox (Tedymiles7@gmail.com) and
   *  prefix the subject with [TEST]. Use this in dev/staging and any time a
   *  flow hasn't been signed off. */
  testMode?: boolean;
}

export interface SendMailResult {
  ok: boolean;
  messageId?: string;
  error?: string;
  /** Recipient the email was actually sent to (after testMode rewrite). */
  deliveredTo: string | string[];
}

export async function sendMail(opts: SendMailOptions): Promise<SendMailResult> {
  let to = opts.to;
  let subject = opts.subject;

  if (opts.testMode) {
    to = APPROVAL_INBOX;
    subject = `[TEST] ${subject}`;
  }

  if (!opts.text && !opts.html) {
    return { ok: false, error: 'Either text or html is required', deliveredTo: to };
  }

  // ── Production: Resend API ────────────────────────────────────────────────
  if (resend) {
    try {
      const recipients = Array.isArray(to) ? to : [to];
      // The early guard above guarantees at least one of text/html is defined.
      // Build the payload in two steps so TS can narrow the union correctly.
      const emailPayload: { to: string[]; from: string; subject: string; replyTo?: string } & (
        | { text: string; html?: string }
        | { html: string; text?: string }
      ) = opts.html
        ? { to: recipients, from: `${FROM_NAME} <${FROM_EMAIL}>`, subject, replyTo: opts.replyTo, text: opts.text ?? undefined, html: opts.html }
        : { to: recipients, from: `${FROM_NAME} <${FROM_EMAIL}>`, subject, replyTo: opts.replyTo, text: opts.text! };

      const { data, error } = await resend.emails.send(emailPayload);
      if (!error) {
        return { ok: true, messageId: data?.id, deliveredTo: to };
      }
      // Resend failed — fall through to nodemailer (e.g. domain not verified yet)
      console.warn(`[email] Resend failed (${error.message}), trying nodemailer fallback`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[email] Resend exception: ${msg}, trying nodemailer fallback`);
    }
  }

  // ── Local dev fallback: nodemailer ──────────────────────────────────────
  try {
    const info = await getTransporter().sendMail({
      from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
      to,
      subject,
      text: opts.text,
      html: opts.html,
      replyTo: opts.replyTo,
    });
    return { ok: true, messageId: info.messageId, deliveredTo: to };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg, deliveredTo: to };
  }
}

/**
 * Verify SMTP connection (nodemailer fallback only).
 * For Resend, the connection is implicit in the API call.
 */
export async function verifySmtp(): Promise<{ ok: boolean; error?: string }> {
  if (resend) {
    // Resend doesn't have a ping — a zero-recipient send is the cheapest check.
    // We just return ok=true and let the first real send catch auth errors.
    return { ok: true };
  }
  try {
    await getTransporter().verify();
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}


===================================
FILE: src/lib/validation.ts
===================================

import { z } from 'zod';

export const emailSchema = z.string().email('Invalid email address').min(1).max(254);

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters');

export const nameSchema = z.string().min(1, 'Name is required').max(100, 'Name is too long');

export const phoneSchema = z.string().max(20).optional();

export const registerSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  attribution: z
    .object({
      source: z.string().optional(),
      medium: z.string().optional(),
      campaign: z.string().optional(),
      ref: z.string().optional(),
      landingUrl: z.string().optional(),
    })
    .optional(),
});

export const clientRegisterSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  phone: phoneSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: passwordSchema,
});

export const createClientSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  phone: phoneSchema,
  company: z.string().max(100).optional(),
});

export const contactFormSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  message: z.string().min(1, 'Message is required').max(5000),
  phone: z.string().max(20).optional(),
  subject: z.string().max(200).optional(),
});

export const deleteClientSchema = z.object({
  id: z.string().min(1, 'Client ID is required'),
});


===================================
FILE: src/lib/cookie.ts
===================================

/**
 * Build a secure Set-Cookie header value for the sf_token auth cookie.
 *
 * Always sets HttpOnly, Path=/, and SameSite=Lax.
 * Secure flag is added in production (Vercel uses HTTPS).
 * Use MaxAge = 0 to clear the cookie (logout).
 */
export function buildAuthCookie(token: string, maxAgeSeconds: number): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  const maxAge = maxAgeSeconds > 0 ? `; Max-Age=${maxAgeSeconds}` : '; Max-Age=0';
  return `sf_token=${token}${maxAge}; HttpOnly; Path=/; SameSite=Lax${secure}`;
}


===================================
FILE: src/app/api/auth/login/route.ts
===================================

import { getJWTSecret } from '@/lib/jwt';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';
import { buildAuthCookie } from '@/lib/cookie';
import { checkRateLimit, clientKey } from '@/lib/rate-limit';
import { loginSchema } from '@/lib/validation';


// 5 attempts per minute per IP — slows credential-stuffing without
// inconveniencing legitimate users who mistype their password.
const LIMIT = { max: 5, windowSec: 60 };

export async function POST(req: Request) {
  const limit = checkRateLimit(clientKey(req, 'auth:login'), LIMIT);
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many login attempts. Try again in a minute.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(limit.resetInSec),
          'X-RateLimit-Remaining': '0',
        },
      }
    );
  }

  try {
    const body = await req.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      const message = parsed.error.errors.map(e => e.message).join('. ');
      return NextResponse.json({ error: message }, { status: 400 });
    }
    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Block login until email is verified.
    if (!user.emailVerified) {
      return NextResponse.json(
        { error: 'Please verify your email before signing in.', needsVerification: true },
        { status: 403 }
      );
    }

    const token = await new SignJWT({ sub: user.id, email: user.email, name: user.name, plan: user.plan, role: user.role })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(getJWTSecret());

    const cookie = buildAuthCookie(token, 7 * 24 * 60 * 60);    return NextResponse.json(
      { user: { id: user.id, email: user.email, name: user.name, plan: user.plan, role: user.role } },
      { headers: { 'Set-Cookie': cookie } }
    );
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}


===================================
FILE: src/app/api/auth/register/route.ts
===================================

import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { sendMail } from '@/lib/email';
import { registerSchema } from '@/lib/validation';

const LIMIT = { max: 10, windowSec: 600 }; // 10 signups / 10 min / IP

export async function POST(req: Request) {
  // Rate limit
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
  const key = `auth:register:${ip}`;
  const { checkRateLimit } = await import('@/lib/rate-limit');
  const limit = checkRateLimit(key, LIMIT);
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many registration attempts. Try again in 10 minutes.' },
      { status: 429, headers: { 'Retry-After': String(limit.resetInSec), 'X-RateLimit-Remaining': '0' } }
    );
  }

  try {
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      const message = parsed.error.errors.map(e => e.message).join('. ');
      return NextResponse.json({ error: message }, { status: 400 });
    }
    const { name, email, password, attribution } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // Capture UTM/referral params if provided
    const utmSource = attribution?.source || null;
    const utmMedium = attribution?.medium || null;
    const utmCampaign = attribution?.campaign || null;
    const ref = attribution?.ref || null;

    // Create user with email NOT verified — they must click the verify link first.
    const user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
        isOwner: true,
        role: 'ADMIN',
        emailVerified: null, // Explicitly set to null to override any database defaults
      },
      select: { id: true, email: true, name: true, emailVerified: true },
    });

    // Persist attribution data if any params were captured
    if (utmSource || utmMedium || utmCampaign || ref) {
      await prisma.leadAttribution.create({
        data: {
          userId: user.id,
          source: utmSource,
          medium: utmMedium,
          campaign: utmCampaign,
          ref,
          landingUrl: attribution?.landingUrl || null,
        },
      });
    }

    // Issue a secure random token valid for 1 hour.
    const token = randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await prisma.verificationToken.create({
      data: { identifier: email, token, expires },
    });

    // Send verification email via the shared email lib (test-mode aware).
    const reqUrl = new URL(req.url);
    const base = process.env.NEXT_PUBLIC_APP_URL || `${reqUrl.protocol}//${reqUrl.host}`;
    const verifyUrl = `${base}/api/auth/verify-email?token=${encodeURIComponent(token)}`;

    const result = await sendMail({
      to: email,
      subject: 'Verify your SendFlow account',
      text: [
        `Hi ${name},`,
        ``,
        `Welcome to SendFlow! Click the link below to verify your email address.`,
        `It expires in 1 hour.`,
        ``,
        verifyUrl,
        ``,
        `If you didn't create a SendFlow account, you can ignore this email.`,
      ].join('\n'),
      html: `
        <p>Hi ${name},</p>
        <p>Welcome to SendFlow! Click the button below to verify your email address.</p>
        <p style="margin:24px 0">
          <a href="${verifyUrl}"
             style="background:#0EA5E9;color:#fff;padding:12px 20px;border-radius:8px;
                    text-decoration:none;display:inline-block;font-weight:600">
            Verify email address
          </a>
        </p>
        <p style="color:#64748B;font-size:13px">
          Or paste this URL: <code style="word-break:break-all">${verifyUrl}</code>
        </p>
        <p style="color:#64748B;font-size:13px">
          This link expires in <strong>1 hour</strong>. If you didn't create a
          SendFlow account, you can safely ignore this email.
        </p>
      `,
      testMode: false, // production — real emails sent to real addresses
    });

    if (!result.ok) {
      console.error('[register] verification email failed:', result.error, { to: email });
      // Account was created — still return 202 so the client can proceed.
      // The user can re-request verification email from the login screen.
      return NextResponse.json(
        {
          message: 'Account created. Check your email to verify your address.',
          deliveredTo: result.deliveredTo,
          emailWarning: 'Verification email could not be sent. Use "Resend" on the login screen.',
        },
        { status: 202 }
      );
    }

    // 202 Accepted — account exists, verify email to activate.
    return NextResponse.json(
      {
        message: 'Account created. Check your email to verify your address.',
        deliveredTo: result.deliveredTo,
      },
      { status: 202 }
    );
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 });
  }
}

===================================
FILE: src/app/api/campaigns/route.ts
===================================

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkCampaignLimit, PLANS, type PlanCode } from '@/lib/plans';
import { getSession } from '@/lib/auth';
import { NextRequest } from 'next/server';

function getUserIdFromCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/sf_token=([^;]+)/);
  if (!match) return null;
  try {
    const payload = JSON.parse(Buffer.from(match[1].split('.')[1], 'base64').toString());
    return payload.sub || null;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const cookieHeader = req.headers.get('cookie');
  const userId = getUserIdFromCookie(cookieHeader);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const campaigns = await prisma.campaign.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { messages: true } } },
  });

  return NextResponse.json({ campaigns });
}

export async function POST(req: Request) {
  const request = req as NextRequest;
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.id;

  const { name, content, mediaUrl, scheduledAt, recurrence, contactIds } = await req.json();
  if (!name || !content) {
    return NextResponse.json({ error: 'Name and content required' }, { status: 400 });
  }

  // Enforce monthly campaign limit
  const canCreate = await checkCampaignLimit(userId, prisma);
  if (!canCreate) {
    const plan = session.plan;
    const max = PLANS[plan as PlanCode]?.maxCampaignsPerMonth ?? 0;
    return NextResponse.json({
      error: `Monthly campaign limit reached. Your ${plan} plan allows ${max} campaigns per month.`,
      code: 'CAMPAIGN_LIMIT_EXCEEDED',
    }, { status: 403 });
  }

  const campaign = await prisma.campaign.create({
    data: {
      userId,
      name,
      content,
      mediaUrl: mediaUrl || null,
      status: scheduledAt ? 'SCHEDULED' : 'DRAFT',
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      recurrence: recurrence || null,
    },
  });

  if (contactIds && contactIds.length > 0) {
    const messageRecords = contactIds.map((contactId: string) => ({
      campaignId: campaign.id,
      contactId,
      status: 'PENDING',
    }));
    await prisma.message.createMany({ data: messageRecords });
  }

  return NextResponse.json({ campaign }, { status: 201 });
}


===================================
FILE: src/app/api/campaigns/send/route.ts
===================================

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import https from 'https';
import http from 'http';

const DAEMON_URL = process.env.WACLI_DAEMON_URL || 'http://84.8.221.131';

// ─── In-Memory Rate Limit (resets on cold start; use Redis in production) ───
const rateMap = new Map<string, any>();
const MAX_PER_MINUTE = 20;
const MAX_PER_DAY = 300;

function checkRateLimit(userId: string): { ok: boolean; retryAfter?: number; reason?: string } {
  const now = Date.now();
  const entry = rateMap.get(userId) || { count: 0, minuteReset: now + 60_000, dayReset: now + 86_400_000 };

  if (now > entry.minuteReset) {
    entry.count = 0;
    entry.minuteReset = now + 60_000;
  }
  if (now > entry.dayReset) {
    entry.count = 0;
    entry.dayReset = now + 86_400_000;
  }

  if (entry.count >= MAX_PER_DAY) {
    const seconds = Math.ceil((entry.dayReset - now) / 1000);
    return { ok: false, retryAfter: seconds, reason: `Daily limit of ${MAX_PER_DAY} messages reached.` };
  }

  const minuteKey = `${userId}:${Math.floor(now / 60_000)}`;
  const minuteEntry = rateMap.get(minuteKey) || { count: 0, resetAt: now + 60_000 };
  if (now > minuteEntry.resetAt) {
    minuteEntry.count = 0;
    minuteEntry.resetAt = now + 60_000;
  }
  if (minuteEntry.count >= MAX_PER_MINUTE) {
    const seconds = Math.ceil((minuteEntry.resetAt - now) / 1000);
    return { ok: false, retryAfter: seconds, reason: `Rate limit: max ${MAX_PER_MINUTE} messages/minute.` };
  }

  minuteEntry.count++;
  rateMap.set(minuteKey, minuteEntry);
  entry.count++;
  rateMap.set(userId, entry);
  return { ok: true };
}

// ─── Native fetch for daemon ────────────────────────────────────────────────
function fetchDaemon(
  path: string,
  options: { method?: string; headers?: http.OutgoingHttpHeaders; body?: string } = {}
): Promise<{ ok: boolean; status: number; json: () => Promise<any> }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, DAEMON_URL);
    const client = url.protocol === 'https:' ? https : http;
    const req = client.request(
      {
        hostname: url.hostname,
        port: url.port || undefined,
        path: url.pathname + url.search,
        method: options.method || 'GET',
        headers: options.headers,
        rejectUnauthorized: false,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          resolve({
            ok: !!(res.statusCode && res.statusCode >= 200 && res.statusCode < 300),
            status: res.statusCode || 0,
            json: () => Promise.resolve(JSON.parse(data)),
          });
        });
      }
    );
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function formatPhone(phone: string): string {
  const clean = (phone || '').replace(/\D/g, '');
  if (clean.startsWith('0')) return `+233${clean.slice(1)}`;
  if (clean.startsWith('233')) return `+${clean}`;
  return `+233${clean}`;
}

function isBusinessHours(timezone: string): boolean {
  try {
    const now = new Date().toLocaleString('en-US', { timeZone: timezone, hour12: false });
    const hour = parseInt(now.split(',')[1].trim().split(':')[0], 10);
    return hour >= 8 && hour < 20;
  } catch {
    return true;
  }
}

function personalize(content: string, name?: string | null): string {
  let msg = content.replace(/\{\{name\}\}/gi, name || 'there');
  const spins = [
    { pattern: /Hi,/gi, variants: ['Hi,', 'Hey,', 'Hello,'] },
    { pattern: /hope you/gi, variants: ['hope you', 'hope that you'] },
    { pattern: /have a lovely/gi, variants: ['have a lovely', 'have a great', 'have a wonderful'] },
    { pattern: /have a good/gi, variants: ['have a good', 'have a nice'] },
  ];
  for (const spin of spins) {
    if (spin.pattern.test(msg)) {
      const variant = spin.variants[Math.floor(Math.random() * spin.variants.length)];
      msg = msg.replace(spin.pattern, variant);
    }
  }
  return msg;
}

function isDuplicate(contact: any, content: string): boolean {
  if (!contact.lastMessageContent || !contact.lastMessageSentAt) return false;
  const daysSince = (Date.now() - new Date(contact.lastMessageSentAt).getTime()) / 86_400_000;
  return contact.lastMessageContent === content && daysSince < 7;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function getHumanDelay(index: number): number {
  const base = 4000 + Math.floor(Math.random() * 8000);
  if (index > 0 && index % 5 === 0) return 15000 + Math.floor(Math.random() * 20000);
  if (index > 0 && index % 10 === 0) return 30000 + Math.floor(Math.random() * 30000);
  return base;
}

async function sendViaDaemon(userId: string, phone: string, message: string): Promise<void> {
  const res = await fetchDaemon('/wacli/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-User-Id': userId,
    },
    body: JSON.stringify({ phone, message }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || `Daemon returned ${res.status}`);
  }
}

// ─── Route ────────────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { campaignId } = body;
  const batchSize = Math.min(parseInt(body.batchSize || '3', 10), 5); // max 5 per batch

  if (!campaignId) {
    return NextResponse.json({ error: 'campaignId required' }, { status: 400 });
  }

  // Hour guard
  if (!isBusinessHours(user.timezone || 'UTC')) {
    return NextResponse.json(
      { error: 'Messages can only be sent between 8:00 AM and 8:00 PM in your timezone.' },
      { status: 403 }
    );
  }

  // Rate limit
  const rateCheck = checkRateLimit(user.id);
  if (!rateCheck.ok) {
    return NextResponse.json(
      { error: rateCheck.reason, retryAfter: rateCheck.retryAfter },
      { status: 429 }
    );
  }

  // Mark SENDING if this is the first batch (campaign status is DRAFT or SCHEDULED)
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId, userId: user.id },
    include: {
      messages: {
        include: { contact: true },
        where: { status: 'PENDING' },
        take: batchSize,
      },
    },
  });

  if (!campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  }

  // If first batch, mark campaign as SENDING
  if (campaign.status === 'DRAFT' || campaign.status === 'SCHEDULED') {
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'SENDING', sentAt: new Date() },
    });
  }

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < campaign.messages.length; i++) {
    const msg = campaign.messages[i];
    const contact = msg.contact;
    const baseContent = campaign.content;

    if (!contact.optedIn) {
      await prisma.message.update({
        where: { id: msg.id },
        data: { status: 'SKIPPED', failureReason: 'Contact has not opted in to WhatsApp messages' },
      });
      skipped++;
      continue;
    }

    if (isDuplicate(contact, baseContent)) {
      await prisma.message.update({
        where: { id: msg.id },
        data: { status: 'SKIPPED', failureReason: 'Duplicate message sent within 7 days' },
      });
      skipped++;
      continue;
    }

    const personalized = personalize(baseContent, contact.name);
    const delay = getHumanDelay(i);
    await sleep(delay);

    const midCheck = checkRateLimit(user.id);
    if (!midCheck.ok) {
      await prisma.message.updateMany({
        where: { campaignId, status: 'PENDING' },
        data: { status: 'PENDING', failureReason: `Rate limited: ${midCheck.reason}` },
      });
      break;
    }

    try {
      const formatted = formatPhone(contact.phone);
      await sendViaDaemon(user.id, formatted, personalized);
      await prisma.message.update({
        where: { id: msg.id },
        data: { status: 'SENT', sentAt: new Date() },
      });
      await prisma.contact.update({
        where: { id: contact.id },
        data: { lastMessageContent: personalized, lastMessageSentAt: new Date() },
      });
      sent++;
    } catch (e: any) {
      await prisma.message.update({
        where: { id: msg.id },
        data: { status: 'FAILED', failureReason: e.message },
      });
      failed++;
    }
  }

  // Count remaining pending
  const remainingPending = await prisma.message.count({
    where: { campaignId, status: 'PENDING' },
  });

  // If nothing remaining, mark final status
  if (remainingPending === 0) {
    const totalMessages = await prisma.message.count({ where: { campaignId } });
    const sentCount = await prisma.message.count({ where: { campaignId, status: 'SENT' } });
    const finalStatus = sentCount > 0 ? 'SENT' : 'FAILED';
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: finalStatus },
    });
  }

  return NextResponse.json({
    sent,
    failed,
    skipped,
    processed: sent + failed + skipped,
    remaining: remainingPending,
    total: await prisma.message.count({ where: { campaignId } }),
    done: remainingPending === 0,
  });
}


===================================
FILE: src/app/api/campaigns/bulk-send/route.ts
===================================

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createHash } from 'crypto';
import { getSession } from '@/lib/auth';
import { requirePlan } from '@/lib/plans';

const DAEMON_URL = process.env.WACLI_DAEMON_URL || 'http://84.8.221.131/wacli';

// KEY_CACHE with TTL — entries expire after 5 minutes to prevent unbounded growth
const KEY_CACHE = new Map<string, { userId: string; expiresAt: number }>();
const KEY_CACHE_TTL_MS = 5 * 60 * 1000;

function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

function cleanKeyCache() {
  const now = Date.now();
  KEY_CACHE.forEach((v, k) => { if (v.expiresAt < now) KEY_CACHE.delete(k); });
}

async function validateKey(rawKey: string): Promise<{ userId: string; plan: string } | null> {
  if (!rawKey) return null;
  cleanKeyCache();
  const h = hashKey(rawKey);
  const cached = KEY_CACHE.get(h);
  if (cached && cached.expiresAt > Date.now()) return { userId: cached.userId, plan: 'FREE' };
  const dbKey = await prisma.apiKey.findFirst({
    where: { key: rawKey },
    select: { userId: true, user: { select: { plan: true } } },
  });
  if (!dbKey) return null;
  const plan = dbKey.user?.plan ?? 'FREE';
  KEY_CACHE.set(h, { userId: dbKey.userId, expiresAt: Date.now() + KEY_CACHE_TTL_MS });
  return { userId: dbKey.userId, plan };
}

function formatPhone(phone: string): string {
  const clean = (phone || '').replace(/\D/g, '');
  if (clean.startsWith('0')) return `+233${clean.slice(1)}`;
  if (clean.startsWith('233')) return `+${clean}`;
  return `+233${clean}`;
}

async function sendViaDaemon(phone: string, message: string): Promise<void> {
  const res = await fetch(`${DAEMON_URL}/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, message }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || `Daemon returned ${res.status}`);
  }
}

export async function POST(req: Request) {
  const request = req as NextRequest;
  const rawKey = request.headers.get('x-sendflow-key');
  let userId: string | null = null;
  let userPlan: string = 'FREE';

  // Try API key first (includes plan), fall back to session
  if (rawKey) {
    const keyResult = await validateKey(rawKey);
    if (keyResult) { userId = keyResult.userId; userPlan = keyResult.plan; }
  }
  if (!userId) {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    userId = session.id;
    userPlan = session.plan;
  }

  // Plan gate — bulk send is a paid feature
  try {
    requirePlan(userPlan, 'bulkSend');
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status });
  }

  try {
    const { name, content, tags, contactIds } = await req.json();
    if (!name || !content) {
      return NextResponse.json({ error: 'name and content required' }, { status: 400 });
    }

    // Find contacts by tags or IDs
    let contacts: { id: string; phone: string; name: string | null }[] = [];
    if (contactIds && contactIds.length > 0) {
      contacts = await prisma.contact.findMany({
        where: { id: { in: contactIds }, userId },
        select: { id: true, phone: true, name: true },
      });
    } else if (tags && tags.length > 0) {
      const allContacts = await prisma.contact.findMany({
        where: { userId },
        select: { id: true, phone: true, name: true, tags: true },
      });
      contacts = allContacts.filter(c => {
        try {
          const t = JSON.parse(c.tags || '[]');
          return tags.some((tag: string) => t.includes(tag));
        } catch { return false; }
      });
    }

    if (contacts.length === 0) {
      return NextResponse.json({ error: 'No contacts found' }, { status: 400 });
    }

    const totalContacts = contacts.length;

    // Create campaign with PENDING status first (not SENDING — we'll update after sends)
    const campaign = await prisma.campaign.create({
      data: {
        userId,
        name,
        content,
        status: 'PENDING',
        sentAt: new Date(),
      },
    });

    // Send messages — one by one via daemon
    let sent = 0, failed = 0, invalid = 0;
    const errors: string[] = [];

    for (const c of contacts) {
      const phone = (c.phone || '').replace(/\D/g, '');
      if (phone.length < 9) { invalid++; continue; }

      try {
        const formatted = formatPhone(phone);
        await sendViaDaemon(formatted, content);
        await prisma.message.create({
          data: { campaignId: campaign.id, contactId: c.id, status: 'SENT', sentAt: new Date() },
        });
        sent++;
      } catch (e: any) {
        // Check if a PENDING message already exists (from prior failed attempt), else create FAILED
        const existing = await prisma.message.findFirst({
          where: { campaignId: campaign.id, contactId: c.id },
        });
        if (existing) {
          await prisma.message.update({ where: { id: existing.id }, data: { status: 'FAILED', failureReason: e.message } });
        } else {
          await prisma.message.create({
            data: { campaignId: campaign.id, contactId: c.id, status: 'FAILED', failureReason: e.message },
          });
        }
        failed++;
        errors.push(`${c.phone}: ${e.message}`);
      }
    }

    // Final status — only SENT if at least some succeeded, else FAILED
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: sent > 0 ? 'SENT' : 'FAILED' },
    });

    return NextResponse.json({
      campaignId: campaign.id,
      sent,
      failed,
      invalid,
      total: totalContacts,
      errors: errors.slice(0, 10), // first 10 errors for debugging
    });
  } catch (err: any) {
    console.error('Bulk send error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

===================================
FILE: src/app/api/contacts/route.ts
===================================

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextRequest } from 'next/server';
import { PLANS, checkContactLimit } from '@/lib/plans';

const KEY_CACHE = new Map<string, string>();
import { createHash } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaLibSQL } from '@prisma/adapter-libsql';
import { createClient } from '@libsql/client';

function getPrisma() {
  const url = process.env.DATABASE_URL || '';
  if (url.startsWith('libsql') || url.startsWith('http')) {
    const libsql = createClient({ url });
    const adapter = new PrismaLibSQL(libsql);
    return new PrismaClient({ adapter } as any);
  }
  return prisma;
}

function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

async function validateKey(rawKey: string): Promise<string | null> {
  if (!rawKey) return null;
  const h = hashKey(rawKey);
  const cached = KEY_CACHE.get(h);
  if (cached) return cached;
  const p = getPrisma();
  const dbKey = await p.apiKey.findFirst({ where: { key: rawKey }, select: { userId: true } });
  if (!dbKey) return null;
  KEY_CACHE.set(h, dbKey.userId);
  return dbKey.userId;
}

export async function POST(req: Request) {
  const request = req as NextRequest;
  const rawKey = request.headers.get('x-sendflow-key');
  let userId: string | null = null;

  // Try API key first, fall back to session
  if (rawKey) {
    userId = await validateKey(rawKey);
  }
  if (!userId) {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    userId = session.id;
  }

  try {
    const { contacts } = await req.json();
    if (!Array.isArray(contacts)) {
      return NextResponse.json({ error: 'contacts array required' }, { status: 400 });
    }

    const overage = await checkContactLimit(userId!, contacts.length, prisma);
    if (overage > 0) {
      const plan = (await prisma.user.findUnique({ where: { id: userId! }, select: { plan: true } }))?.plan ?? 'FREE';
      const max = PLANS[plan as keyof typeof PLANS]?.maxContacts ?? 100;
      return NextResponse.json({
        error: `Contact limit reached. Your ${plan} plan allows ${max} contacts. This import would add ${overage} over the limit.`,
        code: 'CONTACT_LIMIT_EXCEEDED',
        current: max,
        overage,
      }, { status: 403 });
    }

    const results = { created: 0, skipped: 0, errors: [] as string[] };
    for (const c of contacts) {
      try {
        const phone = (c.phone || '').replace(/\D/g, '');
        if (phone.length < 9) {
          results.errors.push(`Invalid phone: ${c.phone}`);
          continue;
        }
        // Check if contact exists
        const existing = await prisma.contact.findFirst({ where: { userId, phone } });
        if (existing) { results.skipped++; continue; }
        await prisma.contact.create({
          data: {
            userId,
            phone,
            name: c.name || null,
            tags: JSON.stringify(Array.isArray(c.tags) ? c.tags : []),
            optedIn: c.optedIn === true,
            optedInAt: c.optedIn === true ? new Date() : null,
            optedInSource: c.optedIn === true ? (c.optedInSource || 'manual-import') : null,
          },
        });
        results.created++;
      } catch (e: any) {
        results.errors.push(`${c.phone}: ${e.message}`);
      }
    }
    return NextResponse.json(results, { status: 201 });
  } catch (err: any) {
    console.error('Contacts POST error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const request = req as NextRequest;
  const rawKey = request.headers.get('x-sendflow-key');
  let userId: string | null = null;

  if (rawKey) {
    userId = await validateKey(rawKey);
  }
  if (!userId) {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    userId = session.id;
  }

  const contacts = await prisma.contact.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({ contacts });
}


===================================
FILE: src/app/api/keys/route.ts
===================================

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { randomBytes } from 'crypto';

export async function GET(req: NextRequest) {
  try {
    const session = await requireSession(req);
    const keys = await prisma.apiKey.findMany({
      where: { userId: session.id },
      select: { id: true, name: true, key: true, lastUsed: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ keys });
  } catch (e) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession(req);
    const { name } = await req.json();
    const keyName = name || 'API Key';

    const rawKey = `sf_${randomBytes(16).toString('hex')}`;
    const keyRecord = await prisma.apiKey.create({
      data: {
        userId: session.id,
        name: keyName,
        key: rawKey,
      },
    });

    return NextResponse.json({
      id: keyRecord.id,
      name: keyRecord.name,
      key: rawKey,
      createdAt: keyRecord.createdAt,
    }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await requireSession(req);
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    await prisma.apiKey.deleteMany({
      where: { id, userId: session.id },
    });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}

===================================
FILE: src/app/api/paystack/webhook/route.ts
===================================

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyWebhookSignature, getPlan } from '@/lib/paystack';

/**
 * POST /api/paystack/webhook
 *
 * Receives events from Paystack. The only event we care about is
 * `charge.success`, but we accept all events for logging.
 *
 * On `charge.success`:
 *   1. Verify HMAC-SHA512 signature against PAYSTACK_SECRET_KEY
 *   2. Idempotently create a Payment row (unique on `ref`)
 *   3. Update the user's plan to match the metadata.plan_code
 *
 * This route runs on Node.js (default) so we can read the raw body
 * for signature verification. Vercel auto-buffers; we need the raw
 * text, not parsed JSON.
 */
export async function POST(req: NextRequest) {
  try {
    // Read the raw body for signature verification.
    const rawBody = await req.text();
    const signature = req.headers.get('x-paystack-signature') || '';

    if (!verifyWebhookSignature(rawBody, signature)) {
      console.warn('Paystack webhook: bad signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    let event: { event: string; data: any };
    try {
      event = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    // Handle charge.success
    if (event.event === 'charge.success') {
      const data = event.data;
      const ref = data.reference as string;
      const amount = data.amount as number; // kobo
      const planCode = (data.metadata?.plan_code as string) || '';
      const userId = (data.metadata?.user_id as string) || '';
      const email = (data.customer?.email as string) || '';

      // Validate plan exists; reject mismatched amounts.
      const plan = getPlan(planCode);
      if (!plan) {
        console.warn('Paystack webhook: unknown plan', planCode);
        return NextResponse.json({ ok: true, skipped: 'unknown plan' });
      }
      if (amount !== plan.amountKobo) {
        console.warn('Paystack webhook: amount mismatch', { ref, amount, expected: plan.amountKobo });
        return NextResponse.json({ ok: true, skipped: 'amount mismatch' });
      }
      if (!userId) {
        console.warn('Paystack webhook: missing user_id metadata', ref);
        return NextResponse.json({ ok: true, skipped: 'no user_id' });
      }

      // Idempotent Payment row. unique(ref) protects against duplicate webhooks.
      try {
        await prisma.payment.create({
          data: {
            userId,
            amount: plan.amountKobo,
            plan: plan.code,
            status: 'SUCCESS',
            ref,
          },
        });
      } catch (err) {
        // P2002 = unique constraint violation = already processed. Safe to no-op.
        const code = (err as any)?.code;
        if (code !== 'P2002') {
          throw err;
        }
      }

      // Update the user's plan
      await prisma.user.update({
        where: { id: userId },
        data: { plan: plan.code },
      });

      console.log(`Paystack: user ${userId} upgraded to ${plan.code} (${email})`);
    }

    // Always return 200 so Paystack stops retrying. Even unknown events get 200.
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Webhook failed';
    console.error('Paystack webhook error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}


===================================
FILE: src/app/api/webhooks/n8n/leads/route.ts
===================================

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


===================================
FILE: src/app/api/webhooks/openclaw/message/route.ts
===================================

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Webhook for OpenClaw agents to send messages back to the SendFlow dashboard.
 * OpenClaw (or any authorized source) POSTs here with a message that gets
 * stored and shown in the UI.
 */

const WEBHOOK_SECRET = process.env.OPENCLAW_WEBHOOK_SECRET || 'openclaw-local-bridge-2026';

export async function POST(req: Request) {
  try {
    const auth = req.headers.get('authorization') || '';
    const token = auth.replace('Bearer ', '');
    if (token !== WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { agentId, message, metadata } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'message required' }, { status: 400 });
    }

    // Store the message in the database
    // Using a generic "SystemMessage" concept via the existing Contact/Activity
    // or just log it. For now we'll store it as a simple log entry.
    // Since there's no dedicated openclaw_message table, we can use a simple
    // key-value or create one. Let's use a lightweight approach.

    // For now, return the message so the caller knows it was received
    console.log(`[OpenClaw Webhook] agent=${agentId}: ${message}`);

    return NextResponse.json({
      success: true,
      receivedAt: new Date().toISOString(),
      agentId: agentId || 'unknown',
      messagePreview: message.slice(0, 200),
    }, { status: 201 });
  } catch (err: any) {
    console.error('openclaw webhook error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'sendflow-openclaw-bridge',
    version: '1.0',
    description: 'POST with Bearer token and JSON body { agentId, message }',
  });
}


===================================
FILE: next.config.js
===================================

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['res.cloudinary.com', 'lh3.googleusercontent.com'],
  },
};

module.exports = nextConfig;


===================================
FILE: package.json (security deps)
===================================

  "dependencies": {
    "bcryptjs": "^2.4.3",
    "jose": "^5.9.3",
    "next": "14.2.18",
  "devDependencies": {
    "prisma": "^5.22.0",
