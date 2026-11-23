/**
 * Lets Connect — RADIUS session service (FreeRADIUS SQL + PoD disconnect).
 *
 * Tables: radcheck, radreply, radacct (Prisma models RadCheck / RadReply / RadAcct)
 */
import type { Package, Prisma, Voucher } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  formatMikrotikRateLimit,
  sessionTimeoutSeconds,
} from "@/lib/radius/attributes";
import { sendDisconnectRequest } from "@/lib/radius/disconnect";
import {
  listOpenRadiusSessions,
  removeVoucherFromRadius,
  syncVoucherToRadius,
  type VoucherWithPackage,
} from "@/lib/radius/sync";
import { withRouterOsApi } from "@/lib/routeros/api-client";

export type { VoucherWithPackage };
export {
  formatMikrotikRateLimit,
  sessionTimeoutSeconds,
  syncVoucherToRadius,
  removeVoucherFromRadius,
  listOpenRadiusSessions,
};

export type ActivateRadiusOptions = {
  mac?: string | null;
  /** Override Session-Timeout (seconds). Defaults to package duration / remaining validUntil. */
  sessionTimeoutSec?: number;
};

/**
 * Create FreeRADIUS entries when a voucher is activated:
 * - radcheck: Cleartext-Password (username = voucher code)
 * - radreply: Mikrotik-Rate-Limit (e.g. 2M/5M), Session-Timeout (seconds)
 */
export async function activateVoucherInRadius(
  voucher: VoucherWithPackage,
  options: ActivateRadiusOptions = {},
): Promise<{
  username: string;
  rateLimit: string | null;
  sessionTimeoutSec: number;
}> {
  const timeout =
    options.sessionTimeoutSec ??
    sessionTimeoutSeconds(voucher.package, voucher.validUntil);

  // Ensure validUntil-aware timeout is applied via package + validUntil on sync
  await syncVoucherToRadius(
    {
      ...voucher,
      validUntil:
        voucher.validUntil ??
        new Date(Date.now() + timeout * 1000),
    },
    { mac: options.mac },
  );

  // Force Session-Timeout to exact seconds (sync already sets it; re-assert for clarity)
  const username = voucher.code;
  await prisma.radReply.deleteMany({
    where: { username, attribute: "Session-Timeout" },
  });
  await prisma.radReply.create({
    data: {
      username,
      attribute: "Session-Timeout",
      op: "=",
      value: String(Math.max(60, timeout)),
    },
  });

  const rateLimit = formatMikrotikRateLimit(
    voucher.package.uploadLimitKbps,
    voucher.package.downloadLimitKbps,
  );

  if (rateLimit) {
    await prisma.radReply.deleteMany({
      where: { username, attribute: "Mikrotik-Rate-Limit" },
    });
    await prisma.radReply.create({
      data: {
        username,
        attribute: "Mikrotik-Rate-Limit",
        op: "=",
        value: rateLimit,
      },
    });
  }

  return {
    username,
    rateLimit,
    sessionTimeoutSec: Math.max(60, timeout),
  };
}

export async function activateVoucherById(
  voucherId: string,
  options: ActivateRadiusOptions = {},
) {
  const voucher = await prisma.voucher.findUnique({
    where: { id: voucherId },
    include: {
      package: true,
      portalSessions: {
        select: { mac: true },
        take: 1,
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!voucher) {
    throw new Error(`Voucher not found: ${voucherId}`);
  }
  return activateVoucherInRadius(voucher, {
    mac: options.mac ?? voucher.portalSessions[0]?.mac,
    sessionTimeoutSec: options.sessionTimeoutSec,
  });
}

/**
 * Disable an expired voucher: remove radcheck/radreply and mark EXPIRED.
 * Optionally sends RADIUS Disconnect-Request (PoD) + RouterOS active remove.
 */
export async function expireVoucher(
  voucherId: string,
  options?: { disconnect?: boolean },
): Promise<{
  expired: boolean;
  radiusRemoved: boolean;
  disconnects: Array<{ method: string; ok: boolean; detail: string }>;
}> {
  const voucher = await prisma.voucher.findUnique({
    where: { id: voucherId },
    include: {
      site: {
        select: {
          id: true,
          nasIdentifier: true,
          radiusSecret: true,
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
  });

  if (!voucher) {
    return { expired: false, radiusRemoved: false, disconnects: [] };
  }

  const openSessions = await listOpenRadiusSessions(voucher.code);
  const mac =
    voucher.portalSessions[0]?.mac ??
    openSessions[0]?.callingStationId ??
    null;

  await removeVoucherFromRadius(voucher.code);

  if (voucher.status !== "EXPIRED") {
    await prisma.voucher.update({
      where: { id: voucher.id },
      data: { status: "EXPIRED" },
    });
  }

  await prisma.portalSession.updateMany({
    where: {
      voucherId: voucher.id,
      status: { in: ["PAID", "AWAITING_PAYMENT", "LOGGED_IN"] },
    },
    data: { status: "EXPIRED" },
  });

  const disconnects: Array<{ method: string; ok: boolean; detail: string }> =
    [];

  if (options?.disconnect !== false) {
    const nasIp = voucher.site.routerHost;
    const secret = voucher.site.radiusSecret;

    if (nasIp && secret) {
      const targets =
        openSessions.length > 0
          ? openSessions.map((session) => ({
              acctSessionId: session.acctSessionId,
              callingStationId: session.callingStationId || mac,
            }))
          : [{ acctSessionId: null as string | null, callingStationId: mac }];

      for (const target of targets) {
        const result = await sendDisconnectRequest({
          nasIp,
          secret,
          username: voucher.code,
          acctSessionId: target.acctSessionId,
          callingStationId: target.callingStationId,
        });
        disconnects.push({
          method: "radius-pod",
          ok: result.ok,
          detail: result.detail,
        });
      }
    }

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
        disconnects.push({
          method: "routeros-api",
          ok: true,
          detail: `removed ${removed} active session(s)`,
        });
      } catch (error) {
        disconnects.push({
          method: "routeros-api",
          ok: false,
          detail: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  return {
    expired: true,
    radiusRemoved: true,
    disconnects,
  };
}

export type ExpireDueResult = {
  scanned: number;
  expired: number;
  disconnectAttempts: number;
  errors: string[];
};

/**
 * Find vouchers past validUntil / shelf-life, mark EXPIRED, strip RADIUS, PoD logoff.
 */
export async function expireDueVouchers(limit = 200): Promise<ExpireDueResult> {
  const now = new Date();
  const errors: string[] = [];
  let expired = 0;
  let disconnectAttempts = 0;

  const due = await prisma.voucher.findMany({
    where: {
      status: { in: ["AVAILABLE", "RESERVED", "SOLD", "ACTIVE"] },
      OR: [
        { validUntil: { lte: now } },
        { AND: [{ status: "AVAILABLE" }, { expiresAt: { lte: now } }] },
      ],
    },
    select: { id: true },
    take: limit,
  });

  for (const row of due) {
    try {
      const result = await expireVoucher(row.id, { disconnect: true });
      if (result.expired) expired += 1;
      disconnectAttempts += result.disconnects.length;
      for (const d of result.disconnects) {
        if (!d.ok) errors.push(`${row.id}: ${d.method}: ${d.detail}`);
      }
    } catch (error) {
      errors.push(
        `${row.id}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  return {
    scanned: due.length,
    expired,
    disconnectAttempts,
    errors,
  };
}

export type ActiveRadiusUser = {
  username: string;
  mac: string;
  framedIp: string;
  nasIp: string;
  sessionId: string;
  startedAt: Date | null;
  inputOctets: bigint | null;
  outputOctets: bigint | null;
  sessionTime: number | null;
};

/**
 * Active Hotspot accounting sessions for a site (radacct where stop time is null).
 */
export async function getActiveUsersForSite(
  siteId: string,
): Promise<ActiveRadiusUser[]> {
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    select: {
      id: true,
      nasIdentifier: true,
      routerHost: true,
    },
  });
  if (!site) return [];

  const voucherCodes = (
    await prisma.voucher.findMany({
      where: {
        siteId,
        status: { in: ["ACTIVE", "SOLD"] },
      },
      select: { code: true },
      take: 2000,
    })
  ).map((v) => v.code);

  const orFilters: Prisma.RadAcctWhereInput[] = [
    { calledStationId: { contains: site.nasIdentifier } },
  ];
  if (site.routerHost) {
    orFilters.push({ nasIpAddress: site.routerHost });
  }
  if (voucherCodes.length > 0) {
    orFilters.push({ username: { in: voucherCodes } });
  }

  const sessions = await prisma.radAcct.findMany({
    where: {
      acctStopTime: null,
      OR: orFilters,
    },
    orderBy: { acctStartTime: "desc" },
    take: 500,
  });

  return sessions.map((s) => ({
    username: s.username,
    mac: s.callingStationId,
    framedIp: s.framedIpAddress,
    nasIp: s.nasIpAddress,
    sessionId: s.acctSessionId,
    startedAt: s.acctStartTime,
    inputOctets: s.acctInputOctets,
    outputOctets: s.acctOutputOctets,
    sessionTime: s.acctSessionTime,
  }));
}

/** Convenience: build rate-limit string for a package (e.g. 2M/5M). */
export function rateLimitForPackage(
  pkg: Pick<Package, "uploadLimitKbps" | "downloadLimitKbps">,
): string | null {
  return formatMikrotikRateLimit(pkg.uploadLimitKbps, pkg.downloadLimitKbps);
}

/** Convenience: package duration → Session-Timeout seconds. */
export function sessionTimeoutForPackage(
  pkg: Pick<Package, "validityValue" | "validityUnit">,
  validUntil?: Date | null,
): number {
  return sessionTimeoutSeconds(pkg, validUntil);
}

export async function loadVoucherWithPackage(
  voucherId: string,
): Promise<(Voucher & { package: Package }) | null> {
  return prisma.voucher.findUnique({
    where: { id: voucherId },
    include: { package: true },
  });
}
