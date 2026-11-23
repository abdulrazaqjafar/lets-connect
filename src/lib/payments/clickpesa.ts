import { createDemoPayment } from "@/lib/payments/demo";
import type { PaymentGateway } from "@/lib/payments/types";

/**
 * ClickPesa — mobile money collections.
 * Env: CLICKPESA_API_KEY, CLICKPESA_SECRET
 */
export const clickpesaGateway: PaymentGateway = {
  id: "CLICKPESA",
  label: "ClickPesa",
  supportsCard: false,
  isConfigured() {
    return Boolean(
      process.env.CLICKPESA_API_KEY?.trim() && process.env.CLICKPESA_SECRET?.trim(),
    );
  },
  async initiate(input) {
    if (!this.isConfigured()) {
      return createDemoPayment("CLICKPESA", input);
    }
    return createDemoPayment("CLICKPESA", input);
  },
};
