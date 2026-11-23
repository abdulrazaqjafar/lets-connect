import { jsonError, jsonOk, handleRouteError } from "@/lib/api";
import { asRouteId } from "@/lib/params";
import { listPortalPackages } from "@/lib/portal/site";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ siteId?: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const param = asRouteId((await context.params).siteId, "siteId");
    if (!param.ok) return param.response;

    const site = await prisma.site.findFirst({
      where: { id: param.id, status: "ACTIVE" },
      select: {
        id: true,
        name: true,
        slug: true,
        location: true,
        nasIdentifier: true,
      },
    });

    if (!site) return jsonError("Site not found", 404);

    const packages = await listPortalPackages(site.id);
    return jsonOk({ site, packages });
  } catch (error) {
    return handleRouteError(error);
  }
}
