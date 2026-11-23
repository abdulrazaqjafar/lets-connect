import { z } from "zod";
import { jsonCreated, jsonError, handleRouteError } from "@/lib/api";
import { createSession } from "@/lib/auth";
import { verifyOtp } from "@/lib/otp";
import { isPlatformPlanCode, type PlatformPlanCode } from "@/lib/plan-catalog";
import { prisma } from "@/lib/prisma";
import { startSubscription } from "@/lib/subscriptions";

const verifySchema = z.object({
  challengeId: z.string().cuid(),
  code: z.string().trim().min(4).max(8),
});

type RegisterPayload = {
  name: string;
  email: string;
  phone: string | null;
  passwordHash: string;
  planCode: string;
};

/**
 * Step 2 — verify OTP, create owner account + trial, start session.
 */
export async function POST(request: Request) {
  try {
    const values = verifySchema.parse(await request.json());
    const result = await verifyOtp({
      challengeId: values.challengeId,
      code: values.code,
      purpose: "REGISTER",
    });
    if (!result.ok) return jsonError(result.error, result.status);

    const payload = result.challenge.payload as RegisterPayload | null;
    if (
      !payload?.email ||
      !payload.passwordHash ||
      !payload.name ||
      !payload.planCode
    ) {
      return jsonError("Registration session invalid — start again", 400);
    }

    if (!isPlatformPlanCode(payload.planCode)) {
      return jsonError("Invalid subscription plan", 400);
    }

    const existing = await prisma.user.findUnique({
      where: { email: payload.email },
    });
    if (existing) {
      return jsonError("Email already registered. Please log in instead.", 409);
    }

    const user = await prisma.user.create({
      data: {
        email: payload.email,
        name: payload.name,
        phone: payload.phone ?? null,
        passwordHash: payload.passwordHash,
        role: "SITE_OWNER",
      },
      select: { id: true, email: true, name: true, phone: true },
    });

    const subscription = await startSubscription(
      user.id,
      payload.planCode as PlatformPlanCode,
      { status: "TRIALING", days: 14 },
    );

    await createSession(user.id);

    return jsonCreated({
      user,
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
