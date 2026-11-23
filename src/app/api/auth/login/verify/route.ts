import { z } from "zod";
import { jsonError, jsonOk, handleRouteError } from "@/lib/api";
import { createSession } from "@/lib/auth";
import { verifyOtp } from "@/lib/otp";
import { prisma } from "@/lib/prisma";
import { getActiveSubscription } from "@/lib/subscriptions";

const verifySchema = z.object({
  challengeId: z.string().cuid(),
  code: z.string().trim().min(4).max(8),
});

/**
 * Step 2 — verify login OTP and create session.
 */
export async function POST(request: Request) {
  try {
    const values = verifySchema.parse(await request.json());
    const result = await verifyOtp({
      challengeId: values.challengeId,
      code: values.code,
      purpose: "LOGIN",
    });
    if (!result.ok) return jsonError(result.error, result.status);

    const userId =
      result.challenge.userId ||
      (result.challenge.payload as { userId?: string } | null)?.userId;
    if (!userId) {
      return jsonError("Login session invalid — try again", 400);
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        ownerId: true,
        isActive: true,
      },
    });
    if (!user?.isActive) {
      return jsonError("Account is disabled", 403);
    }

    await createSession(user.id);

    const billingOwnerId = user.role === "CASHIER" ? user.ownerId : user.id;
    const subscription = billingOwnerId
      ? await getActiveSubscription(billingOwnerId)
      : null;

    const redirectTo =
      user.role === "CASHIER"
        ? "/dashboard/vouchers"
        : subscription
          ? "/dashboard"
          : "/dashboard/billing";

    return jsonOk({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      redirectTo,
      locked: !subscription && user.role !== "CASHIER",
      subscription: subscription
        ? {
            status: subscription.status,
            endsAt: subscription.endsAt,
            plan: {
              code: subscription.plan.code,
              name: subscription.plan.name,
              maxSites: subscription.plan.maxSites,
              priceAmount: subscription.plan.priceAmount,
            },
          }
        : null,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
