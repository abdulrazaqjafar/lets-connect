import { PaymentProvider, type Prisma } from "@prisma/client";
import { createId } from "@/lib/id";
import { prisma } from "@/lib/prisma";
import { generateVoucherCode } from "@/lib/vouchers";
import { buildAutoLoginUrl } from "@/lib/portal/auto-login";
import { PortalPaymentError } from "@/lib/portal/errors";
import { detectMobileMoneyProvider, normalizePhone } from "@/lib/portal/phone";
import { validityToMinutes } from "@/lib/packages";
import { activateVoucherInRadius } from "@/lib/radius";

export { PortalPaymentError } from "@/lib/portal/errors";

export type MobileMoneyProvider = "MPESA" | "TIGO_PESA" | "AIRTEL_MONEY";

export type InitiatePortalPaymentInput = {
  siteId: string;
  packageId: string;
  mac: string;
  linkLoginOnly: string;
  clientIp?: string | null;
  chapId?: string | null;
  chapChallenge?: string | null;
  linkOrig?: string | null;
  userData?: string | null;
  phone: string;
  provider?: MobileMoneyProvider;
};

export async function initiatePortalPayment(input: InitiatePortalPaymentInput) {
  const phone = normalizePhone(input.phone);
  if (!phone) {
    throw new PortalPaymentError(
      "Enter a valid M-Pesa, Tigo, or Airtel number",
      400,
    );
  }

  const site = await prisma.site.findFirst({
    where: { id: input.siteId, status: "ACTIVE" },
    select: { id: true, ownerId: true, name: true },
  });
  if (!site) throw new PortalPaymentError("Site not available", 404);

  const pkg = await prisma.package.findFirst({
    where: { id: input.packageId, siteId: site.id, isActive: true },
  });
  if (!pkg) throw new PortalPaymentError("Package not available", 404);

  const chosen =
    input.provider ?? detectMobileMoneyProvider(phone) ?? "MPESA";
  const mnoProvider =
    chosen === "TIGO_PESA"
      ? PaymentProvider.TIGO_PESA
      : chosen === "AIRTEL_MONEY"
        ? PaymentProvider.AIRTEL_MONEY
        : PaymentProvider.MPESA;

  const { paymentDemoMode, createSnippeMobilePayment, toSnippePhone } =
    await import("@/lib/payments/snippe");
  const demoMode = paymentDemoMode();
  const provider = demoMode ? mnoProvider : PaymentProvider.SNIPPE;

  const externalId = createId("pay");
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  let snippeRef: string | null = null;
  if (!demoMode) {
    const phone255 = toSnippePhone(phone);
    if (!phone255) {
      throw new PortalPaymentError("Enter a valid Tanzania mobile number", 400);
    }
    const created = await createSnippeMobilePayment({
      amountTzs: pkg.priceAmount,
      phone: phone255,
      firstName: "WiFi",
      lastName: "Guest",
      email: `${phone255}@wifi.local`,
      metadata: {
        kind: "portal_voucher",
        externalId,
        siteId: site.id,
        packageId: pkg.id,
        mac: input.mac,
      },
      idempotencyKey: externalId.slice(0, 30),
    });
    snippeRef = created.reference;
  }

  const result = await prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.create({
      data: {
        userId: site.ownerId,
        siteId: site.id,
        packageId: pkg.id,
        provider,
        externalId,
        status: "PENDING",
        amount: pkg.priceAmount,
        currency: pkg.priceCurrency,
        eventType: "stk_push_initiated",
        webhookPayload: {
          phone,
          mac: input.mac,
          provider,
          snippeRef,
          userData: input.userData ?? null,
        } satisfies Prisma.InputJsonValue,
      },
    });

    const session = await tx.portalSession.create({
      data: {
        siteId: site.id,
        packageId: pkg.id,
        transactionId: transaction.id,
        mac: input.mac,
        clientIp: input.clientIp ?? null,
        linkLoginOnly: input.linkLoginOnly,
        chapId: input.chapId ?? null,
        chapChallenge: input.chapChallenge ?? null,
        linkOrig: input.linkOrig ?? null,
        phone,
        provider,
        status: "AWAITING_PAYMENT",
        expiresAt,
      },
    });

    return { transaction, session, package: pkg, site };
  });

  if (demoMode) {
    scheduleDemoConfirmation(externalId, 2500);
  }

  return {
    paymentId: result.transaction.id,
    sessionId: result.session.id,
    externalId,
    providerRef: snippeRef ?? `DEMO-${externalId}`,
    provider,
    amount: pkg.priceAmount,
    currency: pkg.priceCurrency,
    phone,
    expiresAt: expiresAt.toISOString(),
    demoMode,
    message: demoMode
      ? "Demo mode: payment will confirm shortly"
      : "Check your phone for the mobile money prompt (M-Pesa / Airtel / Mixx / Halotel)",
  };
}

const demoTimers = new Map<string, ReturnType<typeof setTimeout>>();

function scheduleDemoConfirmation(externalId: string, delayMs: number) {
  const existing = demoTimers.get(externalId);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(() => {
    void confirmPortalPayment({
      externalId,
      provider: undefined,
      receiptNumber: `DEMO${Date.now()}`,
      rawPayload: { demo: true, externalId },
      eventType: "demo_auto_confirm",
    }).catch((error) => {
      console.error("[payment] demo confirm failed", error);
    });
    demoTimers.delete(externalId);
  }, delayMs);

  demoTimers.set(externalId, timer);
}

export type ConfirmPortalPaymentInput = {
  externalId: string;
  provider?: PaymentProvider | MobileMoneyProvider;
  receiptNumber?: string;
  amount?: number;
  phone?: string;
  rawPayload?: unknown;
  eventType?: string;
  failed?: boolean;
  failureReason?: string;
};

function mapProvider(
  provider?: PaymentProvider | MobileMoneyProvider | string,
): PaymentProvider | undefined {
  if (!provider) return undefined;
  if (provider === "TIGO_PESA" || provider === PaymentProvider.TIGO_PESA) {
    return PaymentProvider.TIGO_PESA;
  }
  if (provider === "AIRTEL_MONEY" || provider === PaymentProvider.AIRTEL_MONEY) {
    return PaymentProvider.AIRTEL_MONEY;
  }
  if (provider === "MPESA" || provider === PaymentProvider.MPESA) {
    return PaymentProvider.MPESA;
  }
  if (provider === "SNIPPE" || provider === PaymentProvider.SNIPPE) {
    return PaymentProvider.SNIPPE;
  }
  return undefined;
}

function isPaidStatus(status: string): boolean {
  return status === "SUCCESS" || status === "COMPLETED";
}

/**
 * Called by payment provider webhooks (or demo mode).
 * On success: creates a voucher and stores MikroTik login credentials on the session.
 */
export async function confirmPortalPayment(input: ConfirmPortalPaymentInput) {
  const mappedProvider = mapProvider(input.provider);
  const transaction = await prisma.transaction.findFirst({
    where: {
      externalId: input.externalId,
      ...(mappedProvider ? { provider: mappedProvider } : {}),
    },
    include: {
      portalSession: true,
      package: true,
      site: true,
    },
  });

  if (!transaction) {
    throw new PortalPaymentError("Payment not found", 404);
  }

  if (isPaidStatus(transaction.status) && transaction.portalSession) {
    const username = transaction.portalSession.loginUsername;
    const password = transaction.portalSession.loginPassword;
    return {
      alreadyProcessed: true,
      transactionId: transaction.id,
      sessionId: transaction.portalSession.id,
      status: "SUCCESS" as const,
      loginUsername: username,
      loginPassword: password,
      linkLoginOnly: transaction.portalSession.linkLoginOnly,
      chapId: transaction.portalSession.chapId,
      chapChallenge: transaction.portalSession.chapChallenge,
      autoLoginUrl:
        username && password
          ? buildAutoLoginUrl({
              username,
              password,
              linkLoginOnly: transaction.portalSession.linkLoginOnly,
            })
          : null,
      voucherCode: username,
    };
  }

  if (input.failed) {
    const failed = await prisma.$transaction(async (tx) => {
      const updatedTx = await tx.transaction.update({
        where: { id: transaction.id },
        data: {
          status: "FAILED",
          eventType: input.eventType ?? "payment_failed",
          failureReason: input.failureReason ?? "Payment failed",
          webhookPayload: input.rawPayload as Prisma.InputJsonValue,
        },
      });

      if (transaction.portalSession) {
        await tx.portalSession.update({
          where: { id: transaction.portalSession.id },
          data: { status: "FAILED" },
        });
      }

      return updatedTx;
    });

    return {
      alreadyProcessed: false,
      transactionId: failed.id,
      sessionId: transaction.portalSession?.id ?? null,
      status: "FAILED" as const,
      loginUsername: null,
      loginPassword: null,
      linkLoginOnly: transaction.portalSession?.linkLoginOnly ?? null,
      chapId: null,
      chapChallenge: null,
    };
  }

  if (!transaction.packageId || !transaction.package || !transaction.portalSession) {
    throw new PortalPaymentError("Payment is missing package or portal session", 400);
  }

  const pkg = transaction.package;
  const session = transaction.portalSession;
  const code = generateVoucherCode(8, "LC");
  const now = new Date();
  const validUntil = new Date(
    now.getTime() + validityToMinutes(pkg.validityValue, pkg.validityUnit) * 60_000,
  );

  const confirmed = await prisma.$transaction(async (tx) => {
    const voucher = await tx.voucher.create({
      data: {
        siteId: transaction.siteId,
        packageId: pkg.id,
        code,
        status: "SOLD",
        buyerPhone: session.phone,
        activatedAt: now,
        validUntil,
        notes: `Portal MAC ${session.mac}`,
      },
    });

    const updatedTx = await tx.transaction.update({
      where: { id: transaction.id },
      data: {
        status: "SUCCESS",
        voucherId: voucher.id,
        paidAt: now,
        eventType: input.eventType ?? "payment_completed",
        webhookPayload: {
          ...(typeof input.rawPayload === "object" && input.rawPayload
            ? (input.rawPayload as object)
            : { raw: input.rawPayload }),
          receiptNumber: input.receiptNumber,
        } as Prisma.InputJsonValue,
      },
    });

    const updatedSession = await tx.portalSession.update({
      where: { id: session.id },
      data: {
        status: "PAID",
        voucherId: voucher.id,
        paidAt: now,
        loginUsername: voucher.code,
        loginPassword: voucher.code,
      },
    });

    return { updatedTx, updatedSession, voucher };
  });

  // radcheck password + radreply Mikrotik-Rate-Limit / Session-Timeout
  try {
    await activateVoucherInRadius(
      {
        ...confirmed.voucher,
        package: pkg,
        portalSessions: [{ mac: session.mac }],
      },
      { mac: session.mac },
    );
  } catch (error) {
    console.error("[radius] failed to activate portal voucher", error);
  }

  const loginUsername = confirmed.updatedSession.loginUsername!;
  const loginPassword = confirmed.updatedSession.loginPassword!;
  const autoLoginUrl = buildAutoLoginUrl({
    username: loginUsername,
    password: loginPassword,
    linkLoginOnly: confirmed.updatedSession.linkLoginOnly,
  });

  return {
    alreadyProcessed: false,
    transactionId: confirmed.updatedTx.id,
    sessionId: confirmed.updatedSession.id,
    status: "SUCCESS" as const,
    loginUsername,
    loginPassword,
    linkLoginOnly: confirmed.updatedSession.linkLoginOnly,
    chapId: confirmed.updatedSession.chapId,
    chapChallenge: confirmed.updatedSession.chapChallenge,
    voucherCode: confirmed.voucher.code,
    autoLoginUrl,
  };
}

export async function getPortalPaymentStatus(paymentId: string) {
  const transaction = await prisma.transaction.findUnique({
    where: { id: paymentId },
    include: {
      portalSession: true,
      package: {
        select: { id: true, name: true, validityValue: true, validityUnit: true },
      },
    },
  });

  if (!transaction?.portalSession) {
    throw new PortalPaymentError("Payment session not found", 404);
  }

  const session = transaction.portalSession;
  const paid =
    isPaidStatus(transaction.status) &&
    (session.status === "PAID" || session.status === "LOGGED_IN");

  const autoLoginUrl =
    paid && session.loginUsername && session.loginPassword
      ? buildAutoLoginUrl({
          username: session.loginUsername,
          password: session.loginPassword,
          linkLoginOnly: session.linkLoginOnly,
        })
      : null;

  return {
    paymentId: transaction.id,
    sessionId: session.id,
    status: isPaidStatus(transaction.status) ? "SUCCESS" : transaction.status,
    sessionStatus: session.status,
    provider: transaction.provider,
    amount: transaction.amount,
    currency: transaction.currency,
    phone: session.phone,
    package: transaction.package,
    paid,
    readyForLogin: Boolean(paid && session.loginUsername && session.loginPassword),
    autoLoginUrl,
    login: paid
      ? {
          username: session.loginUsername,
          password: session.loginPassword,
          linkLoginOnly: session.linkLoginOnly,
          chapId: session.chapId,
          chapChallenge: session.chapChallenge,
          linkOrig: session.linkOrig,
          autoLoginUrl,
        }
      : null,
    failureReason: transaction.failureReason,
  };
}

