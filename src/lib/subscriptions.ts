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

export async function getActiveSubscription(userId: string) {
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
      reason: "No active subscription. Choose a plan on the Pricing page.",
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

  return prisma.subscription.create({
    data: {
      userId,
      planId: plan.id,
      status: options?.status ?? "TRIALING",
      startsAt,
      endsAt,
    },
    include: { plan: true },
  });
}
