import { z } from "zod";
import { jsonCreated, jsonError, handleRouteError } from "@/lib/api";
import { createSession, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isPlatformPlanCode, type PlatformPlanCode } from "@/lib/plan-catalog";
import { startSubscription } from "@/lib/subscriptions";

const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(160),
  phone: z.string().trim().min(9).max(20).optional(),
  password: z.string().min(8).max(72),
  planCode: z.string().trim().default("ngorongoro"),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const values = registerSchema.parse(body);
    const planCode = values.planCode.toLowerCase();

    if (!isPlatformPlanCode(planCode)) {
      return jsonError("Invalid subscription plan", 400);
    }

    const email = values.email.toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return jsonError("Email already registered. Please log in instead.", 409);
    }

    const passwordHash = await hashPassword(values.password);
    const user = await prisma.user.create({
      data: {
        email,
        name: values.name,
        phone: values.phone?.trim() || null,
        passwordHash,
        role: "SITE_OWNER",
      },
      select: { id: true, email: true, name: true },
    });

    const subscription = await startSubscription(
      user.id,
      planCode as PlatformPlanCode,
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
