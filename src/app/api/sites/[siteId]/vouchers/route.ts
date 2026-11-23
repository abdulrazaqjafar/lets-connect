import { jsonError, jsonOk, handleRouteError } from "@/lib/api";
import { requireOwnedSite } from "@/lib/owner";
import { asRouteId } from "@/lib/params";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ siteId?: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const param = asRouteId((await context.params).siteId, "siteId");
    if (!param.ok) return param.response;
    const siteId = param.id;

    const owned = await requireOwnedSite(siteId);
    if (!owned.ok) return jsonError(owned.error, owned.status);

    const { searchParams } = new URL(request.url);
    const batchId = searchParams.get("batchId") ?? undefined;
    const packageId = searchParams.get("packageId") ?? undefined;
    const take = Math.min(Number(searchParams.get("limit") ?? 100), 500);

    const vouchers = await prisma.voucher.findMany({
      where: {
        siteId,
        ...(batchId ? { batchId } : {}),
        ...(packageId ? { packageId } : {}),
      },
      orderBy: { createdAt: "desc" },
      take,
      include: {
        package: {
          select: {
            id: true,
            name: true,
            priceAmount: true,
            priceCurrency: true,
            validityValue: true,
            validityUnit: true,
          },
        },
      },
    });

    return jsonOk({ vouchers });
  } catch (error) {
    return handleRouteError(error);
  }
}
