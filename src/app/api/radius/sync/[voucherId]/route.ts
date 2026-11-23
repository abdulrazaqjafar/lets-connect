import { jsonError, jsonOk, handleRouteError } from "@/lib/api";
import { getOwnerId } from "@/lib/owner";
import { asRouteId } from "@/lib/params";
import { prisma } from "@/lib/prisma";
import { syncVoucherById } from "@/lib/radius/sync";

type RouteContext = { params: Promise<{ voucherId?: string }> };

/** POST /api/radius/sync/[voucherId] — push voucher authz into FreeRADIUS tables */
export async function POST(_request: Request, context: RouteContext) {
  try {
    const param = asRouteId((await context.params).voucherId, "voucherId");
    if (!param.ok) return param.response;

    const ownerId = await getOwnerId();
    if (!ownerId) return jsonError("Owner not configured", 401);

    const voucher = await prisma.voucher.findFirst({
      where: { id: param.id, site: { ownerId } },
      select: { id: true },
    });
    if (!voucher) return jsonError("Voucher not found", 404);

    await syncVoucherById(voucher.id);
    return jsonOk({ synced: true, voucherId: voucher.id });
  } catch (error) {
    return handleRouteError(error);
  }
}
