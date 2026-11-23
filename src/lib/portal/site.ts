import { prisma } from "@/lib/prisma";
import type { ParsedPortalContext } from "@/lib/portal/params";
import { formatSpeed, formatValidity } from "@/lib/packages";
import { getActiveSubscription } from "@/lib/subscriptions";

export type PortalSiteUnavailable = {
  available: false;
  reason: string;
};

export type PortalSiteOk = {
  available: true;
  site: NonNullable<Awaited<ReturnType<typeof findPortalSiteRow>>>;
};

async function findPortalSiteRow(ctx: ParsedPortalContext) {
  if (ctx.nasIdentifier) {
    const byNas = await prisma.site.findFirst({
      where: { nasIdentifier: ctx.nasIdentifier },
    });
    if (byNas) return byNas;
  }

  if (ctx.siteSlug) {
    const bySlug = await prisma.site.findFirst({
      where: { slug: ctx.siteSlug },
    });
    if (bySlug) return bySlug;
  }

  if (process.env.NODE_ENV !== "production") {
    return prisma.site.findFirst({
      orderBy: { createdAt: "asc" },
    });
  }

  return null;
}

/** Resolve site for captive portal; block if suspended or owner subscription dead. */
export async function resolvePortalSite(
  ctx: ParsedPortalContext,
): Promise<PortalSiteOk | PortalSiteUnavailable | null> {
  const site = await findPortalSiteRow(ctx);
  if (!site) return null;

  if (site.status === "ARCHIVED") {
    return { available: false, reason: "This Wi‑Fi site is no longer available." };
  }

  if (site.status === "SUSPENDED") {
    return {
      available: false,
      reason:
        "Wi‑Fi is temporarily unavailable. The operator’s subscription needs renewal.",
    };
  }

  const sub = await getActiveSubscription(site.ownerId);
  if (!sub) {
    return {
      available: false,
      reason:
        "Wi‑Fi is temporarily unavailable. The operator’s trial or subscription has ended.",
    };
  }

  return { available: true, site };
}

export async function listPortalPackages(siteId: string) {
  const packages = await prisma.package.findMany({
    where: { siteId, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { priceAmount: "asc" }],
  });

  return packages.map((pkg) => ({
    id: pkg.id,
    name: pkg.name,
    description: pkg.description,
    priceAmount: pkg.priceAmount,
    priceCurrency: pkg.priceCurrency,
    validityLabel: formatValidity(pkg.validityValue, pkg.validityUnit),
    downloadLabel: formatSpeed(pkg.downloadLimitKbps),
    uploadLabel: formatSpeed(pkg.uploadLimitKbps),
    dataLimitMb: pkg.dataLimitMb,
  }));
}
