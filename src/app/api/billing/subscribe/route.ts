import { z } from "zod";
import { jsonError, jsonOk, handleRouteError } from "@/lib/api";
import { requireOwner } from "@/lib/owner";
import { isPlatformPlanCode, type PlatformPlanCode } from "@/lib/plan-catalog";
import { startSubscription } from "@/lib/subscriptions";

const schema = z.object({
  planCode: z.string().trim().min(1),
});

/**
 * Switch / activate a platform subscription plan.
 * Payment gateway can replace the TRIALING→ACTIVE step later.
 */
export async function POST(request: Request) {
  try {
    const owner = await requireOwner();
    if (!owner.ok) return jsonError(owner.error, owner.status);

    const body = await request.json();
    const { planCode: raw } = schema.parse(body);
    const planCode = raw.toLowerCase();
    if (!isPlatformPlanCode(planCode)) {
      return jsonError("Invalid plan", 400);
    }

    const subscription = await startSubscription(
      owner.ownerId,
      planCode as PlatformPlanCode,
      { status: "ACTIVE", days: 30 },
    );

    return jsonOk({
      subscription: {
        status: subscription.status,
        endsAt: subscription.endsAt,
        plan: {
          code: subscription.plan.code,
          name: subscription.plan.name,
          maxSites: subscription.plan.maxSites,
          priceAmount: subscription.plan.priceAmount,
        },
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
