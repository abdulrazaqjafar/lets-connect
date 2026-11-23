import { jsonCreated, jsonError, jsonOk, handleRouteError } from "@/lib/api";
import { getOwnerId } from "@/lib/owner";
import { packageFormSchema, toPackageCreateData } from "@/lib/packages";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/packages?siteId=xxx
 * List packages for the current site owner (optionally filtered by site).
 */
export async function GET(request: Request) {
  try {
    const ownerId = await getOwnerId();
    if (!ownerId) {
      return jsonError("Owner not configured", 401);
    }

    const { searchParams } = new URL(request.url);
    const siteId = searchParams.get("siteId") ?? undefined;

    if (siteId) {
      const site = await prisma.site.findFirst({
        where: { id: siteId, ownerId },
        select: { id: true },
      });
      if (!site) return jsonError("Site not found", 404);
    }

    const packages = await prisma.package.findMany({
      where: {
        site: { ownerId },
        ...(siteId ? { siteId } : {}),
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      include: {
        site: { select: { id: true, name: true } },
        _count: { select: { vouchers: true } },
      },
    });

    return jsonOk({ packages });
  } catch (error) {
    return handleRouteError(error);
  }
}

/**
 * POST /api/packages
 * Create a hotspot package linked to a site.
 */
export async function POST(request: Request) {
  try {
    const ownerId = await getOwnerId();
    if (!ownerId) {
      return jsonError("Owner not configured", 401);
    }

    const body = await request.json();
    const values = packageFormSchema.parse(body);

    const site = await prisma.site.findFirst({
      where: { id: values.siteId, ownerId },
      select: { id: true },
    });
    if (!site) return jsonError("Site not found", 404);

    const data = toPackageCreateData(values);
    const pkg = await prisma.package.create({
      data,
      include: {
        site: { select: { id: true, name: true } },
        _count: { select: { vouchers: true } },
      },
    });

    return jsonCreated({ package: pkg });
  } catch (error) {
    return handleRouteError(error);
  }
}
