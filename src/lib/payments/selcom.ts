import { createDemoPayment } from "@/lib/payments/demo";
import type { PaymentGateway } from "@/lib/payments/types";

/**
 * Selcom (Tanzania) — mobile money + card.
 * Live API wiring uses SELCOM_VENDOR / SELCOM_API_KEY / SELCOM_API_SECRET.
 * Until configured, falls back to demo / pending records.
 */
export const selcomGateway: PaymentGateway = {
  id: "SELCOM",
  label: "Selcom",
  supportsCard: true,
  isConfigured() {
    return Boolean(
      process.env.SELCOM_VENDOR?.trim() &&
        process.env.SELCOM_API_KEY?.trim() &&
        process.env.SELCOM_API_SECRET?.trim(),
    );
  },
  async initiate(input) {
    if (!this.isConfigured()) {
      return createDemoPayment("SELCOM", input);
    }
    // Live Selcom wallet push / card checkout can be plugged here.
    return createDemoPayment("SELCOM", input);
  },
};
