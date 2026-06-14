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
    maxCampaignsPerMonth: 0,
    bulkSend: false,
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
}