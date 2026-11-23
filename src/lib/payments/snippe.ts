import { Snippe } from "@snippe/sdk";
import { createId } from "@/lib/id";

export function isSnippeConfigured() {
  return Boolean(process.env.SNIPPE_API_KEY?.trim());
}

export function paymentDemoMode() {
  if (process.env.PAYMENT_DEMO_MODE === "true") return true;
  if (process.env.PAYMENT_DEMO_MODE === "false") return false;
  return !isSnippeConfigured();
}

export function getSnippeClient() {
  const apiKey = process.env.SNIPPE_API_KEY?.trim();
  if (!apiKey) throw new Error("SNIPPE_API_KEY is not set");

  const appUrl = (
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_PORTAL_URL?.trim() ||
    "http://18.199.177.29"
  ).replace(/\/$/, "");

  return new Snippe({
    apiKey,
    webhookUrl: `${appUrl}/api/webhooks/snippe`,
  });
}

export type CreateMobilePaymentInput = {
  amountTzs: number;
  phone: string;
  firstName: string;
  lastName: string;
  email: string;
  metadata: Record<string, string>;
  idempotencyKey?: string;
};

/** Normalize TZ phone loosely; SDK also normalises. */
export function toSnippePhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("255") && digits.length >= 12) return digits.slice(0, 12);
  if (digits.startsWith("0") && digits.length >= 10) {
    return `255${digits.slice(1, 10)}`;
  }
  if (digits.length === 9) return `255${digits}`;
  return null;
}

export async function createSnippeMobilePayment(input: CreateMobilePaymentInput) {
  const snippe = getSnippeClient();
  const idempotencyKey = (input.idempotencyKey ?? createId("idp")).slice(0, 30);

  const payment = await snippe.payments.mobile.create(
    {
      amount: input.amountTzs,
      phoneNumber: input.phone,
      customer: {
        firstName: input.firstName.slice(0, 40) || "Customer",
        lastName: input.lastName.slice(0, 40) || "User",
        email: input.email.includes("@")
          ? input.email
          : `${input.phone.replace(/\D/g, "")}@wifi.local`,
      },
      metadata: input.metadata,
    },
    { idempotencyKey },
  );

  return {
    reference: payment.reference,
    status: payment.status,
    raw: payment,
    idempotencyKey,
  };
}
