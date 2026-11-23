import { z } from "zod";
import { jsonError, jsonOk, handleRouteError } from "@/lib/api";
import { createSession, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveSubscription } from "@/lib/subscriptions";

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const values = loginSchema.parse(body);
    const email = values.email.toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        ownerId: true,
        passwordHash: true,
        isActive: true,
      },
    });

    if (!user?.passwordHash || !user.isActive) {
      return jsonError("Invalid email or password", 401);
    }

    const valid = await verifyPassword(values.password, user.passwordHash);
    if (!valid) {
      return jsonError("Invalid email or password", 401);
    }

    await createSession(user.id);

    const billingOwnerId =
      user.role === "CASHIER" ? user.ownerId : user.id;
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
