import type { Package, Voucher } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  buildRadiusAuthRows,
  buildRadiusReplyRows,
} from "@/lib/radius/attributes";

export type VoucherWithPackage = Voucher & {
  package: Package;
  portalSessions?: Array<{ mac: string | null }>;
};

/**
 * Upsert FreeRADIUS radcheck + radreply for a voucher username.
 * Username/password = voucher code (MikroTik Hotspot PAP/CHAP).
 */
export async function syncVoucherToRadius(
  voucher: VoucherWithPackage,
  options?: { mac?: string | null },
): Promise<void> {
  const username = voucher.code;

  if (
    voucher.status === "EXPIRED" ||
    voucher.status === "REVOKED" ||
    (voucher.validUntil && voucher.validUntil.getTime() < Date.now()) ||
    (voucher.expiresAt &&
      voucher.status === "AVAILABLE" &&
      voucher.expiresAt.getTime() < Date.now())
  ) {
    await removeVoucherFromRadius(username);
    return;
  }

  const mac =
    options?.mac ??
    voucher.portalSessions?.find((s) => s.mac)?.mac ??
    null;

  const auth = buildRadiusAuthRows(username, username);
  const authz = buildRadiusReplyRows(voucher.package, {
    validUntil: voucher.validUntil,
    mac: voucher.status === "SOLD" || voucher.status === "ACTIVE" ? mac : null,
  });

  // Prefer package maxDevices over default Simultaneous-Use=1 from auth rows
  const checks = [
    ...auth.checks.filter((row) => row.attribute !== "Simultaneous-Use"),
    ...authz.checks,
  ];
  if (!checks.some((row) => row.attribute === "Simultaneous-Use")) {
    checks.push({ attribute: "Simultaneous-Use", op: ":=", value: "1" });
  }

  const replies = [...auth.replies, ...authz.replies];

  await prisma.$transaction(async (tx) => {
    await tx.radCheck.deleteMany({ where: { username } });
    await tx.radReply.deleteMany({ where: { username } });

    if (checks.length) {
      await tx.radCheck.createMany({
        data: checks.map((row) => ({
          username,
          attribute: row.attribute,
          op: row.op,
          value: row.value,
        })),
      });
    }

    if (replies.length) {
      await tx.radReply.createMany({
        data: replies.map((row) => ({
          username,
          attribute: row.attribute,
          op: row.op,
          value: row.value,
        })),
      });
    }
  });
}

export async function removeVoucherFromRadius(username: string): Promise<void> {
  await prisma.$transaction([
    prisma.radCheck.deleteMany({ where: { username } }),
    prisma.radReply.deleteMany({ where: { username } }),
    prisma.radUserGroup.deleteMany({ where: { username } }),
  ]);
}

export async function syncVoucherById(voucherId: string): Promise<void> {
  const voucher = await prisma.voucher.findUnique({
    where: { id: voucherId },
    include: {
      package: true,
      portalSessions: { select: { mac: true }, take: 1, orderBy: { createdAt: "desc" } },
    },
  });
  if (!voucher) return;
  await syncVoucherToRadius(voucher);
}

export async function syncVouchersByBatch(batchId: string): Promise<number> {
  const vouchers = await prisma.voucher.findMany({
    where: { batchId },
    include: { package: true },
  });

  for (const voucher of vouchers) {
    await syncVoucherToRadius(voucher);
  }
  return vouchers.length;
}

export async function listOpenRadiusSessions(username: string) {
  return prisma.radAcct.findMany({
    where: {
      username,
      acctStopTime: null,
    },
    orderBy: { acctStartTime: "desc" },
  });
}
