import { prisma } from "@/lib/prisma";
import {
  listOpenRadiusSessions,
  removeVoucherFromRadius,
} from "@/lib/radius/sync";
import { withRouterOsApi } from "@/lib/routeros/api-client";

export type SupervisorResult = {
  scanned: number;
  expiredVouchers: number;
  radiusRemoved: number;
  sessionsDisconnected: number;
  errors: string[];
};

/**
 * Real-time-ish Hotspot session supervisor:
 * 1. Find vouchers past validUntil / shelf-life expiresAt
 * 2. Strip FreeRADIUS radcheck/radreply (blocks re-auth)
 * 3. Disconnect active Hotspot sessions via RouterOS API (and/or note open radacct)
 */
export async function runSessionSupervisor(): Promise<SupervisorResult> {
  const now = new Date();
  const errors: string[] = [];
  let expiredVouchers = 0;
  let radiusRemoved = 0;
  let sessionsDisconnected = 0;

  const due = await prisma.voucher.findMany({
    where: {
      status: { in: ["AVAILABLE", "RESERVED", "SOLD", "ACTIVE"] },
      OR: [
        { validUntil: { lte: now } },
        {
          AND: [{ status: "AVAILABLE" }, { expiresAt: { lte: now } }],
        },
      ],
    },
    include: {
      site: {
        select: {
          id: true,
          nasIdentifier: true,
          routerHost: true,
          routerPort: true,
          routerUsername: true,
          routerPassword: true,
        },
      },
      portalSessions: {
        select: { mac: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    take: 200,
  });

  for (const voucher of due) {
    try {
      const openSessions = await listOpenRadiusSessions(voucher.code);
      const mac =
        voucher.portalSessions[0]?.mac ??
        openSessions[0]?.callingStationId ??
        null;

      await removeVoucherFromRadius(voucher.code);
      radiusRemoved += 1;

      await prisma.voucher.update({
        where: { id: voucher.id },
        data: { status: "EXPIRED" },
      });
      expiredVouchers += 1;

      // Prefer live RouterOS disconnect when API credentials exist
      if (
        voucher.site.routerHost &&
        voucher.site.routerUsername &&
        voucher.site.routerPassword
      ) {
        try {
          const removed = await withRouterOsApi(
            {
              host: voucher.site.routerHost,
              port: voucher.site.routerPort ?? 8728,
              username: voucher.site.routerUsername,
              password: voucher.site.routerPassword,
            },
            (api) =>
              api.disconnectHotspotUser({
                username: voucher.code,
                mac: mac ?? undefined,
              }),
          );
          sessionsDisconnected += removed;
        } catch (error) {
          errors.push(
            `RouterOS disconnect failed for ${voucher.code}@${voucher.site.nasIdentifier}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      } else if (openSessions.length > 0) {
        // No API creds — mark accounting awareness; FreeRADIUS reject + Session-Timeout still apply
        sessionsDisconnected += 0;
        errors.push(
          `No RouterOS API creds for site ${voucher.site.nasIdentifier}; removed RADIUS auth for ${voucher.code} (${openSessions.length} open acct session(s))`,
        );
      }

      // Close local portal sessions if any
      await prisma.portalSession.updateMany({
        where: {
          voucherId: voucher.id,
          status: { in: ["PAID", "AWAITING_PAYMENT", "LOGGED_IN"] },
        },
        data: { status: "EXPIRED" },
      });
    } catch (error) {
      errors.push(
        `Expire failed for voucher ${voucher.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  // Kick accounting sessions whose FreeRADIUS auth rows were already removed
  const orphanAcct = await prisma.radAcct.findMany({
    where: { acctStopTime: null },
    select: { username: true, callingStationId: true, nasIpAddress: true },
    take: 100,
  });

  for (const acct of orphanAcct) {
    if (!acct.username) continue;
    const stillAllowed = await prisma.radCheck.findFirst({
      where: { username: acct.username, attribute: "Cleartext-Password" },
    });
    if (stillAllowed) continue;

    const site = await prisma.site.findFirst({
      where: {
        routerHost: acct.nasIpAddress,
        routerUsername: { not: null },
        routerPassword: { not: null },
      },
    });

    if (!site?.routerHost || !site.routerUsername || !site.routerPassword) {
      continue;
    }

    try {
      const removed = await withRouterOsApi(
        {
          host: site.routerHost,
          port: site.routerPort ?? 8728,
          username: site.routerUsername,
          password: site.routerPassword,
        },
        (api) =>
          api.disconnectHotspotUser({
            username: acct.username,
            mac: acct.callingStationId || undefined,
          }),
      );
      sessionsDisconnected += removed;
    } catch (error) {
      errors.push(
        `Orphan disconnect ${acct.username}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  return {
    scanned: due.length,
    expiredVouchers,
    radiusRemoved,
    sessionsDisconnected,
    errors,
  };
}
