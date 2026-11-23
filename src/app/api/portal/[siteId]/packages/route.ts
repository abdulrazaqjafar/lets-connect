import { jsonError, jsonOk, handleRouteError } from "@/lib/api";
import { asRouteId } from "@/lib/params";
import { listPortalPackages } from "@/lib/portal/site";
import { prisma } from "@/lib/prisma";
import { getActiveSubscription } from "@/lib/subscriptions";

type RouteContext = { params: Promise<{ siteId?: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const param = asRouteId((await context.params).siteId, "siteId");
    if (!param.ok) return param.response;

    const site = await prisma.site.findFirst({
      where: { id: param.id },
      select: {
        id: true,
        name: true,
        slug: true,
        location: true,
        nasIdentifier: true,
        status: true,
        ownerId: true,
      },
    });

    if (!site || site.status === "ARCHIVED") {
      return jsonError("Site not found", 404);
    }

    if (site.status === "SUSPENDED") {
      return jsonError(
        "Wi‑Fi is temporarily unavailable. The operator’s subscription needs renewal.",
        403,
      );
    }

    const sub = await getActiveSubscription(site.ownerId);
    if (!sub) {
      return jsonError(
        "Wi‑Fi is temporarily unavailable. The operator’s trial or subscription has ended.",
        403,
      );
    }

    const packages = await listPortalPackages(site.id);
    return jsonOk({
      site: {
        id: site.id,
        name: site.name,
        slug: site.slug,
        location: site.location,
        nasIdentifier: site.nasIdentifier,
      },
      packages,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
