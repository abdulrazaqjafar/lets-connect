import { prisma } from "@/lib/prisma";
import { validityToMinutes } from "@/lib/packages";
import { activateVoucherInRadius } from "@/lib/radius";
import { buildAutoLoginUrl } from "@/lib/portal/auto-login";
import { PortalPaymentError } from "@/lib/portal/errors";

export async function redeemCashVoucher(input: {
  siteId: string;
  code: string;
  mac?: string | null;
  clientIp?: string | null;
  linkLoginOnly?: string | null;
  userData?: string | null;
}) {
  const code = input.code.trim().toUpperCase();
  if (!code) throw new PortalPaymentError("Voucher code is required", 400);

  const site = await prisma.site.findFirst({
    where: { id: input.siteId, status: "ACTIVE" },
    select: { id: true },
  });
  if (!site) throw new PortalPaymentError("Site not available", 404);

  const voucher = await prisma.voucher.findFirst({
    where: {
      siteId: site.id,
      code,
    },
    include: { package: true },
  });

  if (!voucher) throw new PortalPaymentError("Invalid voucher code", 404);

  if (voucher.status === "REVOKED" || voucher.status === "EXPIRED") {
    throw new PortalPaymentError("This voucher is no longer valid", 400);
  }

  if (voucher.expiresAt && voucher.expiresAt.getTime() < Date.now()) {
    await prisma.voucher.update({
      where: { id: voucher.id },
      data: { status: "EXPIRED" },
    });
    throw new PortalPaymentError("This voucher has expired", 400);
  }

  if (voucher.status === "ACTIVE" || voucher.status === "SOLD") {
    // Already used — allow re-login with same code if still within validUntil
    if (voucher.validUntil && voucher.validUntil.getTime() < Date.now()) {
      throw new PortalPaymentError("This voucher session has ended", 400);
    }
  } else if (voucher.status !== "AVAILABLE" && voucher.status !== "RESERVED") {
    throw new PortalPaymentError("This voucher cannot be used", 400);
  }

  const now = new Date();
  const needsActivation =
    voucher.status === "AVAILABLE" ||
    voucher.status === "RESERVED" ||
    !voucher.activatedAt;

  const validUntil =
    voucher.validUntil ??
    new Date(
      now.getTime() +
        validityToMinutes(
          voucher.package.validityValue,
          voucher.package.validityUnit,
        ) *
          60_000,
    );

  const updated = needsActivation
    ? await prisma.voucher.update({
        where: { id: voucher.id },
        data: {
          status: "ACTIVE",
          activatedAt: now,
          validUntil,
          notes: [voucher.notes, input.mac ? `MAC ${input.mac}` : null, input.userData]
            .filter(Boolean)
            .join(" · "),
        },
        include: { package: true },
      })
    : voucher;

  try {
    await activateVoucherInRadius(
      {
        ...updated,
        package: updated.package,
        portalSessions: input.mac ? [{ mac: input.mac }] : [],
      },
      { mac: input.mac },
    );
  } catch (error) {
    console.error("[radius] cash voucher activate failed", error);
  }

  const username = updated.code;
  const password = updated.code;
  const autoLoginUrl = buildAutoLoginUrl({
    username,
    password,
    linkLoginOnly: input.linkLoginOnly,
  });

  return {
    voucherId: updated.id,
    code: updated.code,
    packageName: updated.package.name,
    validUntil: updated.validUntil,
    loginUsername: username,
    loginPassword: password,
    linkLoginOnly: input.linkLoginOnly ?? null,
    autoLoginUrl,
  };
}
