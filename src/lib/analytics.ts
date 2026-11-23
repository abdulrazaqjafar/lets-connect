import type { DashboardAnalytics } from "@/lib/analytics-types";
import { prisma } from "@/lib/prisma";
import { getActiveUsersForSite } from "@/lib/radius";

export type { DashboardAnalytics };

const SUCCESS_STATUSES = ["SUCCESS", "COMPLETED"] as const;

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

/**
 * Owner-scoped revenue / session / voucher KPIs for the overview dashboard.
 */
export async function getOwnerAnalytics(
  ownerId: string,
): Promise<DashboardAnalytics> {
  const sites = await prisma.site.findMany({
    where: { ownerId },
    select: { id: true, name: true },
  });
  const siteIds = sites.map((s) => s.id);
  const siteNameById = new Map(sites.map((s) => [s.id, s.name]));

  if (siteIds.length === 0) {
    return emptyAnalytics();
  }

  const since = startOfDay(new Date());
  since.setDate(since.getDate() - 29);

  const [revenueAgg, soldCount, availableCount, recentTx, packageGroups, activeCounts] =
    await Promise.all([
      prisma.transaction.aggregate({
        where: {
          userId: ownerId,
          status: { in: [...SUCCESS_STATUSES] },
        },
        _sum: { amount: true },
      }),
      prisma.voucher.count({
        where: {
          siteId: { in: siteIds },
          status: { in: ["SOLD", "ACTIVE"] },
        },
      }),
      prisma.voucher.count({
        where: {
          siteId: { in: siteIds },
          status: "AVAILABLE",
        },
      }),
      prisma.transaction.findMany({
        where: {
          userId: ownerId,
          status: { in: [...SUCCESS_STATUSES] },
          OR: [
            { paidAt: { gte: since } },
            { AND: [{ paidAt: null }, { createdAt: { gte: since } }] },
          ],
        },
        select: {
          amount: true,
          currency: true,
          paidAt: true,
          createdAt: true,
          packageId: true,
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.voucher.groupBy({
        by: ["packageId"],
        where: {
          siteId: { in: siteIds },
          status: { in: ["SOLD", "ACTIVE", "EXPIRED"] },
        },
        _count: { _all: true },
        orderBy: { _count: { packageId: "desc" } },
        take: 8, // Prisma orders groups by count of packageId
      }),
      Promise.all(siteIds.map((id) => getActiveUsersForSite(id))),
    ]);

  const packages = await prisma.package.findMany({
    where: { id: { in: packageGroups.map((g) => g.packageId) } },
    select: {
      id: true,
      name: true,
      siteId: true,
      priceAmount: true,
      priceCurrency: true,
    },
  });
  const packageById = new Map(packages.map((p) => [p.id, p]));

  const packageRevenue = await prisma.transaction.groupBy({
    by: ["packageId"],
    where: {
      userId: ownerId,
      status: { in: [...SUCCESS_STATUSES] },
      packageId: { in: packageGroups.map((g) => g.packageId) },
    },
    _sum: { amount: true },
  });
  const revenueByPackage = new Map(
    packageRevenue.map((row) => [row.packageId ?? "", row._sum.amount ?? 0]),
  );

  const topPackages = packageGroups
    .map((group) => {
      const pkg = packageById.get(group.packageId);
      if (!pkg) return null;
      return {
        packageId: pkg.id,
        name: pkg.name,
        siteName: siteNameById.get(pkg.siteId) ?? "Site",
        soldCount: group._count._all,
        revenue:
          revenueByPackage.get(pkg.id) ??
          group._count._all * pkg.priceAmount,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((a, b) => b.revenue - a.revenue || b.soldCount - a.soldCount)
    .slice(0, 5);

  const dailyMap = new Map<string, { revenue: number; transactions: number }>();
  for (let i = 0; i < 30; i += 1) {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    dailyMap.set(dayKey(d), { revenue: 0, transactions: 0 });
  }

  for (const tx of recentTx) {
    const when = tx.paidAt ?? tx.createdAt;
    const key = dayKey(startOfDay(when));
    const bucket = dailyMap.get(key);
    if (!bucket) continue;
    bucket.revenue += tx.amount;
    bucket.transactions += 1;
  }

  const dailyRevenue = Array.from(dailyMap.entries()).map(([date, value]) => ({
    date,
    revenue: value.revenue,
    transactions: value.transactions,
  }));

  const activeOnlineUsers = activeCounts.reduce(
    (sum, sessions) => sum + sessions.length,
    0,
  );

  return {
    currency: "TZS",
    totalRevenue: revenueAgg._sum.amount ?? 0,
    activeOnlineUsers,
    vouchersSold: soldCount,
    vouchersAvailable: availableCount,
    topPackages,
    dailyRevenue,
  };
}

function emptyAnalytics(): DashboardAnalytics {
  const since = startOfDay(new Date());
  since.setDate(since.getDate() - 29);
  const dailyRevenue = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    return { date: dayKey(d), revenue: 0, transactions: 0 };
  });

  return {
    currency: "TZS",
    totalRevenue: 0,
    activeOnlineUsers: 0,
    vouchersSold: 0,
    vouchersAvailable: 0,
    topPackages: [],
    dailyRevenue,
  };
}
