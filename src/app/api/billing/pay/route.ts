import { z } from "zod";
import { PaymentProvider } from "@prisma/client";
import { jsonCreated, jsonError, handleRouteError } from "@/lib/api";
import { createId } from "@/lib/id";
import { requireBillingOwner } from "@/lib/owner";
import { prisma } from "@/lib/prisma";
import {
  createSnippeMobilePayment,
  paymentDemoMode,
  toSnippePhone,
} from "@/lib/payments/snippe";
import {
  activatePaidSubscription,
  ensureSubscriptionPlans,
  isPlatformPlanCode,
  type PlatformPlanCode,
} from "@/lib/subscriptions";

const schema = z.object({
  planCode: z.string().trim().min(1),
  phone: z.string().trim().min(9).max(20),
});

/**
 * POST /api/billing/pay
 * Start Snippe mobile money payment for a SaaS plan (30 days ACTIVE).
 */
export async function POST(request: Request) {
  try {
    const owner = await requireBillingOwner();
    if (!owner.ok) return jsonError(owner.error, owner.status);

    const body = schema.parse(await request.json());
    const planCode = body.planCode.toLowerCase();
    if (!isPlatformPlanCode(planCode)) {
      return jsonError("Invalid plan", 400);
    }

    await ensureSubscriptionPlans();
    const plan = await prisma.subscriptionPlan.findUnique({
      where: { code: planCode },
    });
    if (!plan || !plan.isActive) return jsonError("Plan not available", 404);

    const phone255 = toSnippePhone(body.phone);
    if (!phone255) {
      return jsonError("Enter a valid Tanzania mobile number", 400);
    }

    const externalId = createId("subpay");
    const demo = paymentDemoMode();

    let snippeRef = externalId;
    if (!demo) {
      const nameParts = (owner.user.name ?? "Owner").split(/\s+/);
      const created = await createSnippeMobilePayment({
        amountTzs: plan.priceAmount,
        phone: phone255,
        firstName: nameParts[0] ?? "Owner",
        lastName: nameParts.slice(1).join(" ") || "Account",
        email: owner.user.email,
        metadata: {
          kind: "subscription",
          externalId,
          userId: owner.ownerId,
          planId: plan.id,
          planCode: plan.code,
        },
        idempotencyKey: externalId.slice(0, 30),
      });
      snippeRef = created.reference;
    }

    const payment = await prisma.subscriptionPayment.create({
      data: {
        userId: owner.ownerId,
        planId: plan.id,
        amount: plan.priceAmount,
        currency: "TZS",
        phone: phone255,
        provider: PaymentProvider.SNIPPE,
        externalId,
        snippeRef,
        status: "PENDING",
      },
    });

    if (demo) {
      // Local/EC2 without Snippe keys — activate after short delay
      setTimeout(() => {
        void (async () => {
          try {
            const subscription = await activatePaidSubscription(
              owner.ownerId,
              plan.id,
              30,
            );
            await prisma.subscriptionPayment.update({
              where: { id: payment.id },
              data: {
                status: "SUCCESS",
                paidAt: new Date(),
                subscriptionId: subscription.id,
                webhookPayload: { demo: true },
              },
            });
          } catch (error) {
            console.error("[billing] demo activate failed", error);
          }
        })();
      }, 2500);
    }

    return jsonCreated({
      paymentId: payment.id,
      externalId,
      snippeRef,
      amount: plan.priceAmount,
      currency: "TZS",
      demoMode: demo,
      message: demo
        ? "Demo mode: subscription will activate in a few seconds"
        : "Check your phone for the mobile money prompt",
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
