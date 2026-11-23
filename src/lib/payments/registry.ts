import { azampayGateway } from "@/lib/payments/azampay";
import { clickpesaGateway } from "@/lib/payments/clickpesa";
import {
  createSnippeMobilePayment,
  isSnippeConfigured,
  paymentDemoMode,
  toSnippePhone,
} from "@/lib/payments/snippe";
import { createDemoPayment } from "@/lib/payments/demo";
import { selcomGateway } from "@/lib/payments/selcom";
import type {
  InitiateMobilePaymentInput,
  InitiateMobilePaymentResult,
  MobileMoneyProviderId,
  PaymentGateway,
} from "@/lib/payments/types";
import { createId } from "@/lib/id";

const snippeGateway: PaymentGateway = {
  id: "SNIPPE",
  label: "Snippe",
  supportsCard: false,
  isConfigured: isSnippeConfigured,
  async initiate(input) {
    if (paymentDemoMode() || !isSnippeConfigured()) {
      return createDemoPayment("SNIPPE", input);
    }
    const phone = toSnippePhone(input.phone);
    if (!phone) throw new Error("Invalid Tanzania phone number");
    const payment = await createSnippeMobilePayment({
      ...input,
      phone,
    });
    return {
      provider: "SNIPPE",
      reference: payment.reference,
      externalId: payment.idempotencyKey,
      status: payment.status === "completed" ? "COMPLETED" : "PENDING",
      checkoutUrl: null,
      demo: false,
    };
  },
};

const GATEWAYS: Record<MobileMoneyProviderId, PaymentGateway> = {
  SNIPPE: snippeGateway,
  SELCOM: selcomGateway,
  CLICKPESA: clickpesaGateway,
  AZAMPAY: azampayGateway,
};

export function listPaymentGateways() {
  return Object.values(GATEWAYS).map((g) => ({
    id: g.id,
    label: g.label,
    supportsCard: g.supportsCard,
    configured: g.isConfigured(),
    demo: paymentDemoMode() || !g.isConfigured(),
  }));
}

export function resolvePaymentGateway(
  preferred?: string | null,
): PaymentGateway {
  const key = (preferred ?? process.env.DEFAULT_PAYMENT_PROVIDER ?? "SNIPPE")
    .trim()
    .toUpperCase() as MobileMoneyProviderId;
  return GATEWAYS[key] ?? snippeGateway;
}

export async function initiateSitePayment(
  preferred: string | null | undefined,
  input: InitiateMobilePaymentInput,
): Promise<InitiateMobilePaymentResult> {
  const gateway = resolvePaymentGateway(preferred);
  try {
    return await gateway.initiate({
      ...input,
      idempotencyKey: input.idempotencyKey ?? createId("pay"),
    });
  } catch (error) {
    // Fall back to demo record so portal never hard-crashes without keys
    if (paymentDemoMode()) {
      return createDemoPayment(gateway.id, input);
    }
    throw error;
  }
}
