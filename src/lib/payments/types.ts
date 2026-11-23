import type { PaymentProvider } from "@prisma/client";

export type MobileMoneyProviderId =
  | "SNIPPE"
  | "SELCOM"
  | "CLICKPESA"
  | "AZAMPAY";

export type InitiateMobilePaymentInput = {
  amountTzs: number;
  phone: string;
  firstName: string;
  lastName: string;
  email: string;
  metadata: Record<string, string>;
  idempotencyKey?: string;
  /** Card checkout when provider supports it */
  channel?: "mobile_money" | "card";
};

export type InitiateMobilePaymentResult = {
  provider: PaymentProvider;
  reference: string;
  externalId: string;
  status: "PENDING" | "COMPLETED" | "FAILED";
  checkoutUrl?: string | null;
  message?: string;
  demo?: boolean;
};

export type PaymentGateway = {
  id: MobileMoneyProviderId;
  label: string;
  supportsCard: boolean;
  isConfigured: () => boolean;
  initiate: (input: InitiateMobilePaymentInput) => Promise<InitiateMobilePaymentResult>;
};
