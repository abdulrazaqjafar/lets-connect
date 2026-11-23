import { jsonCreated, jsonError, jsonOk, handleRouteError } from "@/lib/api";
import { requireOwnedSite } from "@/lib/owner";
import { packageFormSchema, toPackageCreateData } from "@/lib/packages";
import { asRouteId } from "@/lib/params";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ siteId?: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const param = asRouteId((await context.params).siteId, "siteId");
    if (!param.ok) return param.response;
    const siteId = param.id;

    const owned = await requireOwnedSite(siteId);
    if (!owned.ok) return jsonError(owned.error, owned.status);

    const packages = await prisma.package.findMany({
      where: { siteId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      include: {
        _count: { select: { vouchers: true } },
      },
    });

    return jsonOk({ packages });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const param = asRouteId((await context.params).siteId, "siteId");
    if (!param.ok) return param.response;
    const siteId = param.id;

    const owned = await requireOwnedSite(siteId);
    if (!owned.ok) return jsonError(owned.error, owned.status);

    const body = await request.json();
    const values = packageFormSchema.parse({ ...body, siteId });
    const data = toPackageCreateData(values);

    const pkg = await prisma.package.create({ data });
    return jsonCreated({ package: pkg });
  } catch (error) {
    return handleRouteError(error);
  }
}
