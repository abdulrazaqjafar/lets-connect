import { prisma } from "@/lib/prisma";
import type { ParsedPortalContext } from "@/lib/portal/params";
import { formatSpeed, formatValidity } from "@/lib/packages";

export async function resolvePortalSite(ctx: ParsedPortalContext) {
  if (ctx.nasIdentifier) {
    const byNas = await prisma.site.findFirst({
      where: { nasIdentifier: ctx.nasIdentifier, status: "ACTIVE" },
    });
    if (byNas) return byNas;
  }

  if (ctx.siteSlug) {
    const bySlug = await prisma.site.findFirst({
      where: { slug: ctx.siteSlug, status: "ACTIVE" },
    });
    if (bySlug) return bySlug;
  }

  // Dev fallback: first active site when nas is omitted
  if (process.env.NODE_ENV !== "production") {
    return prisma.site.findFirst({
      where: { status: "ACTIVE" },
      orderBy: { createdAt: "asc" },
    });
  }

  return null;
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
