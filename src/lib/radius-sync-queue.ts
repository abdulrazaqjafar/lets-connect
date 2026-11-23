import { prisma } from "@/lib/prisma";
import { activateVoucherInRadius } from "@/lib/radius";

/** Activate in RADIUS now; on failure queue for later (offline-tolerant cash/portal). */
export async function activateVoucherWithRetry(opts: {
  voucherId: string;
  siteId: string;
  mac?: string | null;
}) {
  const voucher = await prisma.voucher.findUnique({
    where: { id: opts.voucherId },
    include: { package: true },
  });
  if (!voucher) return { synced: false as const, queued: false as const };

  try {
    await activateVoucherInRadius(
      {
        ...voucher,
        package: voucher.package,
        portalSessions: opts.mac ? [{ mac: opts.mac }] : [],
      },
      { mac: opts.mac },
    );
    await prisma.voucher.update({
      where: { id: voucher.id },
      data: { radiusSyncStatus: "SYNCED", radiusSyncedAt: new Date() },
    });
    await prisma.radiusSyncJob.updateMany({
      where: { voucherId: voucher.id, status: "PENDING" },
      data: { status: "SYNCED" },
    });
    return { synced: true as const, queued: false as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : "RADIUS sync failed";
    console.error("[radius-sync]", voucher.code, message);

    await prisma.voucher.update({
      where: { id: voucher.id },
      data: { radiusSyncStatus: "PENDING" },
    });

    const existing = await prisma.radiusSyncJob.findFirst({
      where: { voucherId: voucher.id, status: "PENDING" },
    });
    if (existing) {
      await prisma.radiusSyncJob.update({
        where: { id: existing.id },
        data: {
          lastError: message,
          mac: opts.mac ?? existing.mac,
          nextRunAt: new Date(Date.now() + 30_000),
        },
      });
    } else {
      await prisma.radiusSyncJob.create({
        data: {
          siteId: opts.siteId,
          voucherId: voucher.id,
          mac: opts.mac ?? null,
          status: "PENDING",
          lastError: message,
          nextRunAt: new Date(Date.now() + 15_000),
        },
      });
    }

    return { synced: false as const, queued: true as const };
  }
}

/** Process pending RADIUS sync jobs (cron / supervisor). */
export async function processRadiusSyncQueue(limit = 40) {
  const now = new Date();
  const jobs = await prisma.radiusSyncJob.findMany({
    where: { status: "PENDING", nextRunAt: { lte: now } },
    orderBy: { nextRunAt: "asc" },
    take: limit,
    include: {
      voucher: { include: { package: true } },
    },
  });

  let synced = 0;
  let failed = 0;

  for (const job of jobs) {
    try {
      await activateVoucherInRadius(
        {
          ...job.voucher,
          package: job.voucher.package,
          portalSessions: job.mac ? [{ mac: job.mac }] : [],
        },
        { mac: job.mac },
      );
      await prisma.$transaction([
        prisma.radiusSyncJob.update({
          where: { id: job.id },
          data: { status: "SYNCED", lastError: null },
        }),
        prisma.voucher.update({
          where: { id: job.voucherId },
          data: { radiusSyncStatus: "SYNCED", radiusSyncedAt: new Date() },
        }),
      ]);
      synced += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "sync failed";
      const attempts = job.attempts + 1;
      await prisma.radiusSyncJob.update({
        where: { id: job.id },
        data: {
          attempts,
          lastError: message,
          status: attempts >= 12 ? "FAILED" : "PENDING",
          nextRunAt: new Date(Date.now() + Math.min(attempts * 60_000, 15 * 60_000)),
        },
      });
      if (attempts >= 12) {
        await prisma.voucher.update({
          where: { id: job.voucherId },
          data: { radiusSyncStatus: "FAILED" },
        });
        failed += 1;
      }
    }
  }

  return { processed: jobs.length, synced, failed };
}
