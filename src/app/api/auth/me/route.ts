import { jsonError, jsonOk, handleRouteError } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { getSiteQuota } from "@/lib/subscriptions";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return jsonError("Not authenticated", 401);

    const quota = await getSiteQuota(user.id);

    return jsonOk({
      user,
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
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
