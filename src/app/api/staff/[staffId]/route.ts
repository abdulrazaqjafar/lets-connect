import { jsonError, jsonOk, handleRouteError } from "@/lib/api";
import { asRouteId } from "@/lib/params";
import { requireBillingOwner } from "@/lib/owner";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ staffId?: string }> };

/** DELETE /api/staff/[staffId] — deactivate / remove cashier */
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const owner = await requireBillingOwner();
    if (!owner.ok) return jsonError(owner.error, owner.status);

    const param = asRouteId((await context.params).staffId, "staffId");
    if (!param.ok) return param.response;

    const cashier = await prisma.user.findFirst({
      where: {
        id: param.id,
        ownerId: owner.ownerId,
        role: "CASHIER",
      },
    });
    if (!cashier) return jsonError("Staff not found", 404);

    await prisma.user.delete({ where: { id: cashier.id } });
    return jsonOk({ deleted: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
