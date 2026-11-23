import { jsonOk, handleRouteError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { ensureSubscriptionPlans } from "@/lib/subscriptions";

export async function GET() {
  try {
    await ensureSubscriptionPlans();
    const plans = await prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    });
    return jsonOk({ plans });
  } catch (error) {
    return handleRouteError(error);
  }
}
