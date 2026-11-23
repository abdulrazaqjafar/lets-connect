import { jsonError, jsonOk, handleRouteError } from "@/lib/api";
import { asRouteId } from "@/lib/params";
import { requireBillingOwner } from "@/lib/owner";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ paymentId?: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const owner = await requireBillingOwner();
    if (!owner.ok) return jsonError(owner.error, owner.status);

    const param = asRouteId((await context.params).paymentId, "paymentId");
    if (!param.ok) return param.response;

    const payment = await prisma.subscriptionPayment.findFirst({
      where: { id: param.id, userId: owner.ownerId },
      include: { plan: true, subscription: true },
    });
    if (!payment) return jsonError("Payment not found", 404);

    return jsonOk({
      paymentId: payment.id,
      status: payment.status,
      amount: payment.amount,
      currency: payment.currency,
      plan: {
        code: payment.plan.code,
        name: payment.plan.name,
      },
      paidAt: payment.paidAt,
      subscriptionEndsAt: payment.subscription?.endsAt ?? null,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
