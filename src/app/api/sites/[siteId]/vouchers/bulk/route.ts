import { createId } from "@/lib/id";
import { jsonCreated, jsonError, handleRouteError } from "@/lib/api";
import { requireOwnedSite } from "@/lib/owner";
import { asRouteId } from "@/lib/params";
import { prisma } from "@/lib/prisma";
import { syncVouchersByBatch } from "@/lib/radius/sync";
import { bulkVoucherSchema, generateUniqueCodes } from "@/lib/vouchers";

type RouteContext = { params: Promise<{ siteId?: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const param = asRouteId((await context.params).siteId, "siteId");
    if (!param.ok) return param.response;
    const siteId = param.id;

    const owned = await requireOwnedSite(siteId);
    if (!owned.ok) return jsonError(owned.error, owned.status);

    const body = await request.json();
    const values = bulkVoucherSchema.parse(body);

    const pkg = await prisma.package.findFirst({
      where: { id: values.packageId, siteId, isActive: true },
    });

    if (!pkg) {
      return jsonError("Active package not found for this site", 404);
    }

    const existing = await prisma.voucher.findMany({
      where: { siteId },
      select: { code: true },
    });
    const existingCodes = new Set(existing.map((v) => v.code));

    const codes = generateUniqueCodes(
      values.quantity,
      values.codeLength,
      values.prefix ?? "",
      existingCodes,
    );

    const batchId = createId();
    const expiresAt =
      values.shelfLifeDays && values.shelfLifeDays > 0
        ? new Date(Date.now() + values.shelfLifeDays * 24 * 60 * 60 * 1000)
        : null;
    const notes = values.notes?.trim() ? values.notes.trim() : null;

    await prisma.voucher.createMany({
      data: codes.map((code) => ({
        siteId,
        packageId: pkg.id,
        code,
        batchId,
        status: "AVAILABLE" as const,
        expiresAt,
        notes,
      })),
    });

    const vouchers = await prisma.voucher.findMany({
      where: { batchId },
      orderBy: { code: "asc" },
      include: {
        package: {
          select: {
            id: true,
            name: true,
            priceAmount: true,
            priceCurrency: true,
            validityValue: true,
            validityUnit: true,
            downloadLimitKbps: true,
            uploadLimitKbps: true,
          },
        },
      },
    });

    let radiusSynced = 0;
    try {
      radiusSynced = await syncVouchersByBatch(batchId);
    } catch (error) {
      console.error("[radius] bulk voucher sync failed", error);
    }

    return jsonCreated({
      batchId,
      count: vouchers.length,
      radiusSynced,
      vouchers,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
