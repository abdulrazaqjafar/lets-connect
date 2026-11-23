import { jsonError, jsonOk, handleRouteError } from "@/lib/api";
import { getOwnerId } from "@/lib/owner";
import { packageFormSchema, toPackageCreateData } from "@/lib/packages";
import { asRouteId } from "@/lib/params";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ packageId?: string }> };

async function getOwnedPackage(packageId: string) {
  const ownerId = await getOwnerId();
  if (!ownerId) {
    return { ok: false as const, error: "Owner not configured", status: 401 as const };
  }

  const pkg = await prisma.package.findFirst({
    where: { id: packageId, site: { ownerId } },
    include: { site: { select: { id: true, name: true, ownerId: true } } },
  });

  if (!pkg) {
    return { ok: false as const, error: "Package not found", status: 404 as const };
  }

  return { ok: true as const, ownerId, pkg };
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const param = asRouteId((await context.params).packageId, "packageId");
    if (!param.ok) return param.response;

    const result = await getOwnedPackage(param.id);
    if (!result.ok) return jsonError(result.error, result.status);
    return jsonOk({ package: result.pkg });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const param = asRouteId((await context.params).packageId, "packageId");
    if (!param.ok) return param.response;

    const result = await getOwnedPackage(param.id);
    if (!result.ok) return jsonError(result.error, result.status);

    const body = await request.json();
    const values = packageFormSchema.parse({
      ...body,
      siteId: body.siteId ?? result.pkg.siteId,
    });
    const data = toPackageCreateData(values);

    const { siteId: _siteId, ...updateData } = data;
    const pkg = await prisma.package.update({
      where: { id: param.id },
      data: updateData,
    });

    return jsonOk({ package: pkg });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const param = asRouteId((await context.params).packageId, "packageId");
    if (!param.ok) return param.response;

    const result = await getOwnedPackage(param.id);
    if (!result.ok) return jsonError(result.error, result.status);

    const voucherCount = await prisma.voucher.count({
      where: { packageId: param.id },
    });

    if (voucherCount > 0) {
      const pkg = await prisma.package.update({
        where: { id: param.id },
        data: { isActive: false },
      });
      return jsonOk({
        package: pkg,
        deactivated: true,
        message: "Package has vouchers, so it was deactivated instead of deleted.",
      });
    }

    await prisma.package.delete({ where: { id: param.id } });
    return jsonOk({ deleted: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
