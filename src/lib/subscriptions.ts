import {
  isPlatformPlanCode,
  PLATFORM_PLANS,
  type PlatformPlanCode,
} from "@/lib/plan-catalog";
import { prisma } from "@/lib/prisma";

export { PLATFORM_PLANS, isPlatformPlanCode, type PlatformPlanCode };

export async function ensureSubscriptionPlans() {
  for (const plan of PLATFORM_PLANS) {
    await prisma.subscriptionPlan.upsert({
      where: { code: plan.code },
      update: {
        name: plan.name,
        description: plan.description,
        priceAmount: plan.priceAmount,
        priceCurrency: "TZS",
        maxSites: plan.maxSites,
        sortOrder: plan.sortOrder,
        highlighted: plan.highlighted,
        features: [...plan.features],
        isActive: true,
      },
      create: {
        code: plan.code,
        name: plan.name,
        description: plan.description,
        priceAmount: plan.priceAmount,
        priceCurrency: "TZS",
        maxSites: plan.maxSites,
        sortOrder: plan.sortOrder,
        highlighted: plan.highlighted,
        features: [...plan.features],
        isActive: true,
      },
    });
  }
}

const ACTIVE_STATUSES = ["TRIALING", "ACTIVE"] as const;

/**
 * Mark expired TRIALING/ACTIVE rows as EXPIRED and suspend the owner's sites.
 */
export async function expireStaleSubscriptionsForUser(userId: string) {
  const now = new Date();
  const stale = await prisma.subscription.findMany({
    where: {
      userId,
      status: { in: [...ACTIVE_STATUSES] },
      endsAt: { lte: now },
    },
    select: { id: true },
  });
  if (stale.length === 0) return { expired: 0 };

  await prisma.subscription.updateMany({
    where: { id: { in: stale.map((s) => s.id) } },
    data: { status: "EXPIRED" },
  });

  await prisma.site.updateMany({
    where: { ownerId: userId, status: "ACTIVE" },
    data: { status: "SUSPENDED" },
  });

  return { expired: stale.length };
}

export async function getActiveSubscription(userId: string) {
  await expireStaleSubscriptionsForUser(userId);

  return prisma.subscription.findFirst({
    where: {
      userId,
      status: { in: [...ACTIVE_STATUSES] },
      OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }],
    },
    include: { plan: true },
    orderBy: { createdAt: "desc" },
  });
}

export type SubscriptionAccess =
  | {
      ok: true;
      subscription: NonNullable<Awaited<ReturnType<typeof getActiveSubscription>>>;
      locked: false;
    }
  | {
      ok: false;
      subscription: null;
      locked: true;
      reason: string;
      status: 402;
    };

/** Site ops + portal require an unexpired TRIALING/ACTIVE plan. */
export async function requireActiveSubscription(
  userId: string,
): Promise<SubscriptionAccess> {
  const subscription = await getActiveSubscription(userId);
  if (!subscription) {
    return {
      ok: false,
      subscription: null,
      locked: true,
      reason:
        "Your trial or subscription has ended. Renew on Billing to restore sites and Wi‑Fi portal.",
      status: 402,
    };
  }
  return { ok: true, subscription, locked: false };
}

export async function unsuspendOwnerSites(userId: string) {
  await prisma.site.updateMany({
    where: { ownerId: userId, status: "SUSPENDED" },
    data: { status: "ACTIVE" },
  });
}

export async function getSiteQuota(userId: string) {
  const subscription = await getActiveSubscription(userId);
  const siteCount = await prisma.site.count({ where: { ownerId: userId } });

  if (!subscription) {
    return {
      ok: false as const,
      maxSites: 0,
      usedSites: siteCount,
      remaining: 0,
      plan: null,
      subscription: null,
      locked: true as const,
      reason: "No active subscription. Renew on the Billing page.",
    };
  }

  const maxSites = subscription.plan.maxSites;
  const remaining = Math.max(0, maxSites - siteCount);

  return {
    ok: remaining > 0,
    maxSites,
    usedSites: siteCount,
    remaining,
    plan: subscription.plan,
    subscription,
    locked: false as const,
    reason:
      remaining > 0
        ? null
        : `The ${subscription.plan.name} plan allows ${maxSites} site${maxSites === 1 ? "" : "s"} only. Upgrade to add more.`,
  };
}

export async function startSubscription(
  userId: string,
  planCode: PlatformPlanCode,
  options?: { status?: "TRIALING" | "ACTIVE"; days?: number },
) {
  await ensureSubscriptionPlans();
  const plan = await prisma.subscriptionPlan.findUnique({
    where: { code: planCode },
  });
  if (!plan) throw new Error(`Unknown plan: ${planCode}`);

  const days = options?.days ?? 30;
  const startsAt = new Date();
  const endsAt = new Date(startsAt.getTime() + days * 24 * 60 * 60 * 1000);

  await prisma.subscription.updateMany({
    where: {
      userId,
      status: { in: ["TRIALING", "ACTIVE"] },
    },
    data: {
      status: "CANCELED",
      canceledAt: new Date(),
    },
  });

  const subscription = await prisma.subscription.create({
    data: {
      userId,
      planId: plan.id,
      status: options?.status ?? "TRIALING",
      startsAt,
      endsAt,
    },
    include: { plan: true },
  });

  if (subscription.status === "ACTIVE" || subscription.status === "TRIALING") {
    await unsuspendOwnerSites(userId);
  }

  return subscription;
}

/** Activate or extend plan after Snippe subscription payment. */
export async function activatePaidSubscription(
  userId: string,
  planId: string,
  days = 30,
) {
  const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
  if (!plan) throw new Error("Plan not found");

  await prisma.subscription.updateMany({
    where: { userId, status: { in: ["TRIALING", "ACTIVE", "PAST_DUE"] } },
    data: { status: "CANCELED", canceledAt: new Date() },
  });

  const startsAt = new Date();
  const endsAt = new Date(startsAt.getTime() + days * 24 * 60 * 60 * 1000);

  const subscription = await prisma.subscription.create({
    data: {
      userId,
      planId: plan.id,
      status: "ACTIVE",
      startsAt,
      endsAt,
    },
    include: { plan: true },
  });

  await unsuspendOwnerSites(userId);
  return subscription;
}

/** Cron: expire all stale subscriptions platform-wide. */
export async function expireAllStaleSubscriptions() {
  const now = new Date();
  const stale = await prisma.subscription.findMany({
    where: {
      status: { in: [...ACTIVE_STATUSES] },
      endsAt: { lte: now },
    },
    select: { id: true, userId: true },
  });
  if (stale.length === 0) return { expired: 0, users: 0 };

  const userIds = [...new Set(stale.map((s) => s.userId))];
  await prisma.subscription.updateMany({
    where: { id: { in: stale.map((s) => s.id) } },
    data: { status: "EXPIRED" },
  });
  await prisma.site.updateMany({
    where: { ownerId: { in: userIds }, status: "ACTIVE" },
    data: { status: "SUSPENDED" },
  });

  return { expired: stale.length, users: userIds.length };
}
