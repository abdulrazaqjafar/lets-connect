import { createDemoPayment } from "@/lib/payments/demo";
import type { PaymentGateway } from "@/lib/payments/types";

/**
 * AzamPay — MNO push + card.
 * Env: AZAMPAY_APP_NAME, AZAMPAY_CLIENT_ID, AZAMPAY_CLIENT_SECRET
 */
export const azampayGateway: PaymentGateway = {
  id: "AZAMPAY",
  label: "AzamPay",
  supportsCard: true,
  isConfigured() {
    return Boolean(
      process.env.AZAMPAY_APP_NAME?.trim() &&
        process.env.AZAMPAY_CLIENT_ID?.trim() &&
        process.env.AZAMPAY_CLIENT_SECRET?.trim(),
    );
  },
  async initiate(input) {
    if (!this.isConfigured()) {
      return createDemoPayment("AZAMPAY", input);
    }
    return createDemoPayment("AZAMPAY", input);
  },
};
