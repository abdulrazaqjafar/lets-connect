import { jsonCreated, jsonError, jsonOk, handleRouteError } from "@/lib/api";
import { getOwnerId, requireOwnerWithSubscription } from "@/lib/owner";
import { prisma } from "@/lib/prisma";
import { syncSiteToNasTable } from "@/lib/radius/nas";
import {
  generateNasIdentifier,
  generateRadiusSecret,
  siteFormSchema,
  slugify,
} from "@/lib/sites";
import { getSiteQuota } from "@/lib/subscriptions";

export async function GET() {
  try {
    const ownerId = await getOwnerId();
    if (!ownerId) {
      return jsonError(
        "Please log in or sign up to view your sites.",
        401,
      );
    }

    const { getCurrentUser } = await import("@/lib/auth");
    const sessionUser = await getCurrentUser();

    let where: { ownerId: string; id?: { in: string[] } } = { ownerId };
    if (sessionUser?.role === "CASHIER") {
      const assigned = await prisma.cashierSite.findMany({
        where: { cashierId: sessionUser.id },
        select: { siteId: true },
      });
      where = {
        ownerId,
        id: { in: assigned.map((a) => a.siteId) },
      };
    }

    const sites = await prisma.site.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        slug: true,
        location: true,
        address: true,
        routerModel: true,
        nasIdentifier: true,
        radiusSecret: true,
        status: true,
        brandName: true,
        brandLogoUrl: true,
        brandPrimaryColor: true,
        brandDomain: true,
        venueType: true,
        paymentProvider: true,
        routerHost: true,
        portalRedirectStatus: true,
        portalRedirectCheckedAt: true,
        portalRedirectDetail: true,
        createdAt: true,
        _count: { select: { packages: true, vouchers: true } },
      },
    });

    return jsonOk({ sites });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const owner = await requireOwnerWithSubscription();
    if (!owner.ok) return jsonError(owner.error, owner.status);
    const ownerId = owner.ownerId;

    const quota = await getSiteQuota(ownerId);
    if (!quota.ok) {
      return jsonError(quota.reason ?? "Site limit reached", quota.locked ? 402 : 403, {
        usedSites: quota.usedSites,
        maxSites: quota.maxSites,
        plan: quota.plan
          ? { code: quota.plan.code, name: quota.plan.name }
          : null,
      });
    }

    const body = await request.json();
    const values = siteFormSchema.parse(body);

    const baseSlug = slugify(values.name);
    let slug = baseSlug;
    let attempt = 1;
    while (
      await prisma.site.findFirst({
        where: { ownerId, slug },
        select: { id: true },
      })
    ) {
      attempt += 1;
      slug = `${baseSlug}-${attempt}`;
    }

    let nasIdentifier = generateNasIdentifier(values.name);
    while (
      await prisma.site.findUnique({
        where: { nasIdentifier },
        select: { id: true },
      })
    ) {
      nasIdentifier = generateNasIdentifier(values.name);
    }

    const radiusSecret = generateRadiusSecret();

    const site = await prisma.site.create({
      data: {
        ownerId,
        name: values.name,
        slug,
        location: values.location,
        address: values.location,
        routerModel: values.routerModel,
        venueType: values.venueType ?? "OTHER",
        nasIdentifier,
        radiusSecret,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        location: true,
        routerModel: true,
        nasIdentifier: true,
        radiusSecret: true,
        status: true,
        createdAt: true,
        _count: { select: { packages: true, vouchers: true } },
      },
    });

    try {
      await syncSiteToNasTable({
        name: site.name,
        nasIdentifier: site.nasIdentifier,
        radiusSecret: site.radiusSecret,
      });
    } catch (error) {
      console.error("[radius] nas table sync failed", error);
    }

    return jsonCreated({ site });
  } catch (error) {
    return handleRouteError(error);
  }
}
