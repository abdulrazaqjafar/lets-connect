import { jsonError, jsonOk, handleRouteError } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { getSiteQuota, requireActiveSubscription } from "@/lib/subscriptions";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return jsonError("Not authenticated", 401);

    const billingOwnerId =
      user.role === "CASHIER"
        ? (
            await (
              await import("@/lib/prisma")
            ).prisma.user.findFirst({
              where: { id: user.id },
              select: { ownerId: true },
            })
          )?.ownerId
        : user.id;

    if (!billingOwnerId) {
      return jsonError("Cashier is not linked to an owner account", 403);
    }

    const quota = await getSiteQuota(billingOwnerId);
    const access = await requireActiveSubscription(billingOwnerId);

    return jsonOk({
      user,
      locked: access.locked === true,
      lockReason: access.ok ? null : access.reason,
      subscription: quota.plan
        ? {
            status: quota.subscription?.status,
            endsAt: quota.subscription?.endsAt,
            plan: {
              code: quota.plan.code,
              name: quota.plan.name,
              maxSites: quota.plan.maxSites,
              priceAmount: quota.plan.priceAmount,
              priceCurrency: quota.plan.priceCurrency,
            },
          }
        : null,
      quota: {
        usedSites: quota.usedSites,
        maxSites: quota.maxSites,
        remaining: quota.remaining,
        locked: quota.locked === true,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
