import { createId } from "@/lib/id";
import type {
  InitiateMobilePaymentInput,
  InitiateMobilePaymentResult,
  MobileMoneyProviderId,
} from "@/lib/payments/types";
import { paymentDemoMode } from "@/lib/payments/snippe";

/** Shared demo / stub checkout when a gateway has no live credentials. */
export function createDemoPayment(
  provider: MobileMoneyProviderId,
  input: InitiateMobilePaymentInput,
): InitiateMobilePaymentResult {
  const externalId = (input.idempotencyKey ?? createId("pay")).slice(0, 40);
  return {
    provider,
    reference: `${provider.toLowerCase()}_${externalId}`,
    externalId,
    status: paymentDemoMode() ? "COMPLETED" : "PENDING",
    checkoutUrl: null,
    message: paymentDemoMode()
      ? `${provider} demo: payment auto-confirmed`
      : `${provider} credentials missing — payment recorded as pending`,
    demo: true,
  };
}
