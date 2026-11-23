import {
  verifyWebhook,
  SnippeWebhookVerificationError,
  type AnyWebhookEvent,
} from "@snippe/sdk";
import { PaymentProvider } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { confirmPortalPayment } from "@/lib/portal/payment";
import { activatePaidSubscription } from "@/lib/subscriptions";

export const runtime = "nodejs";

/**
 * POST /api/webhooks/snippe
 * Snippe payment.completed / payment.failed — raw body required for HMAC.
 */
export async function POST(request: Request) {
  const signingKey = process.env.SNIPPE_WEBHOOK_SECRET?.trim();
  if (!signingKey) {
    console.error("[snippe] SNIPPE_WEBHOOK_SECRET missing");
    return new Response("Webhook not configured", { status: 503 });
  }

  const rawBody = Buffer.from(await request.arrayBuffer());
  const signature = request.headers.get("x-webhook-signature");
  const timestamp = request.headers.get("x-webhook-timestamp");

  let event: AnyWebhookEvent;
  try {
    event = verifyWebhook({
      rawBody,
      signature,
      timestamp,
      signingKey,
    });
  } catch (error) {
    if (error instanceof SnippeWebhookVerificationError) {
      return new Response("Invalid signature", { status: 400 });
    }
    console.error("[snippe] verify failed", error);
    return new Response("Bad request", { status: 400 });
  }

  try {
    if (
      event.type === "payment.completed" ||
      event.type === "payment.failed" ||
      event.type === "payment.cancelled" ||
      event.type === "payment.reversed"
    ) {
      const data = event.data;
      const metadata = (data.metadata ?? {}) as Record<string, string>;
      const kind = metadata.kind ?? "";
      const failed =
        event.type === "payment.failed" ||
        event.type === "payment.cancelled" ||
        event.type === "payment.reversed";

      if (kind === "subscription") {
        await handleSubscriptionWebhook({
          reference: data.reference,
          failed,
          failureReason: data.failure_reason,
          raw: event,
        });
      } else if (kind === "portal_voucher") {
        await confirmPortalPayment({
          externalId: metadata.externalId || data.reference,
          provider: undefined, // match by externalId only (may be SNIPPE or MNO)
          receiptNumber: data.external_reference ?? data.reference,
          rawPayload: event,
          eventType: event.type,
          failed,
          failureReason: data.failure_reason,
        });
      } else {
        // Fallback: match by snippe reference on either table
        const subPay = await prisma.subscriptionPayment.findFirst({
          where: {
            OR: [{ snippeRef: data.reference }, { externalId: data.reference }],
          },
        });
        if (subPay) {
          await handleSubscriptionWebhook({
            reference: data.reference,
            failed,
            failureReason: data.failure_reason,
            raw: event,
          });
        } else {
          await confirmPortalPayment({
            externalId: data.reference,
            provider: PaymentProvider.SNIPPE,
            receiptNumber: data.external_reference ?? data.reference,
            rawPayload: event,
            eventType: event.type,
            failed,
            failureReason: data.failure_reason,
          }).catch(() => {
            console.warn("[snippe] unmatched payment", data.reference);
          });
        }
      }
    }

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("[snippe] webhook handler error", error);
    return new Response("Handler error", { status: 500 });
  }
}

async function handleSubscriptionWebhook(input: {
  reference: string;
  failed: boolean;
  failureReason?: string;
  raw: unknown;
}) {
  const payment = await prisma.subscriptionPayment.findFirst({
    where: {
      OR: [{ snippeRef: input.reference }, { externalId: input.reference }],
    },
  });
  if (!payment) {
    console.warn("[snippe] subscription payment not found", input.reference);
    return;
  }

  if (payment.status === "SUCCESS" || payment.status === "COMPLETED") {
    return;
  }

  if (input.failed) {
    await prisma.subscriptionPayment.update({
      where: { id: payment.id },
      data: {
        status: "FAILED",
        webhookPayload: input.raw as object,
      },
    });
    return;
  }

  const subscription = await activatePaidSubscription(
    payment.userId,
    payment.planId,
    30,
  );

  await prisma.subscriptionPayment.update({
    where: { id: payment.id },
    data: {
      status: "SUCCESS",
      paidAt: new Date(),
      subscriptionId: subscription.id,
      snippeRef: input.reference,
      webhookPayload: input.raw as object,
    },
  });
}
