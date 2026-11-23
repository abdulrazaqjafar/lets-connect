import { z } from "zod";
import { jsonError, jsonOk, handleRouteError } from "@/lib/api";
import {
  confirmPortalPayment,
  PortalPaymentError,
} from "@/lib/portal/payment";
import { prisma } from "@/lib/prisma";

/**
 * Payment provider webhook (M-Pesa Daraja callback / Tigo Pesa IPN).
 *
 * Accepts a normalized payload:
 * {
 *   externalId: string,       // our checkout id OR provider checkout id we stored
 *   provider?: "MPESA" | "TIGO_PESA",
 *   status: "SUCCESS" | "FAILED",
 *   receiptNumber?: string,
 *   amount?: number,
 *   phone?: string,
 *   Body?: unknown            // raw Safaricom-style envelope also supported
 * }
 *
 * On SUCCESS: issues voucher credentials and marks portal session PAID.
 * The captive portal polls status and POSTs to MikroTik link-login-only.
 */
const webhookSchema = z.object({
  externalId: z.string().min(1).optional(),
  CheckoutRequestID: z.string().min(1).optional(),
  provider: z.enum(["MPESA", "TIGO_PESA"]).optional(),
  status: z.enum(["SUCCESS", "FAILED", "COMPLETED", "PENDING"]).optional(),
  ResultCode: z.union([z.number(), z.string()]).optional(),
  receiptNumber: z.string().optional(),
  MpesaReceiptNumber: z.string().optional(),
  amount: z.number().optional(),
  phone: z.string().optional(),
  failureReason: z.string().optional(),
  ResultDesc: z.string().optional(),
  Body: z.unknown().optional(),
});

function extractFromSafaricomBody(body: unknown): {
  externalId?: string;
  resultCode?: number;
  receiptNumber?: string;
  amount?: number;
  phone?: string;
  resultDesc?: string;
} {
  if (!body || typeof body !== "object") return {};
  const root = body as Record<string, unknown>;
  const stk = (root.stkCallback ?? root) as Record<string, unknown>;
  const metadata = stk.CallbackMetadata as
    | { Item?: Array<{ Name?: string; Value?: unknown }> }
    | undefined;

  const items = metadata?.Item ?? [];
  const find = (name: string) =>
    items.find((item) => item.Name === name)?.Value;

  return {
    externalId:
      typeof stk.CheckoutRequestID === "string"
        ? stk.CheckoutRequestID
        : undefined,
    resultCode:
      typeof stk.ResultCode === "number"
        ? stk.ResultCode
        : typeof stk.ResultCode === "string"
          ? Number(stk.ResultCode)
          : undefined,
    receiptNumber:
      typeof find("MpesaReceiptNumber") === "string"
        ? (find("MpesaReceiptNumber") as string)
        : undefined,
    amount:
      typeof find("Amount") === "number" ? (find("Amount") as number) : undefined,
    phone:
      find("PhoneNumber") !== undefined ? String(find("PhoneNumber")) : undefined,
    resultDesc:
      typeof stk.ResultDesc === "string" ? stk.ResultDesc : undefined,
  };
}

export async function POST(request: Request) {
  try {
    const secret = process.env.PAYMENT_WEBHOOK_SECRET;
    if (secret) {
      const header =
        request.headers.get("x-webhook-secret") ??
        request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
      if (header !== secret) {
        return jsonError("Unauthorized webhook", 401);
      }
    }

    const raw = await request.json();
    const parsed = webhookSchema.parse(raw);
    const fromStk = extractFromSafaricomBody(parsed.Body ?? raw.Body);

    let externalId =
      parsed.externalId ??
      parsed.CheckoutRequestID ??
      fromStk.externalId;

    // Allow looking up by providerRef stored during initiate (demo uses externalId)
    if (!externalId) {
      return jsonError("externalId / CheckoutRequestID is required", 400);
    }

    // If provider sent their own checkout id, try matching our pending tx by payload phone later;
    // primary path: externalId is the id we created at initiate time.
    const existing = await prisma.transaction.findFirst({
      where: { externalId },
      select: { id: true },
    });
    if (!existing) {
      // Fallback: treat CheckoutRequestID as stored in webhookPayload later — for now 404
      return jsonError("Unknown payment reference", 404);
    }

    const resultCode =
      parsed.ResultCode !== undefined
        ? Number(parsed.ResultCode)
        : fromStk.resultCode;

    const failed =
      parsed.status === "FAILED" ||
      (resultCode !== undefined && !Number.isNaN(resultCode) && resultCode !== 0);

    const result = await confirmPortalPayment({
      externalId,
      provider: parsed.provider,
      receiptNumber:
        parsed.receiptNumber ??
        parsed.MpesaReceiptNumber ??
        fromStk.receiptNumber,
      amount: parsed.amount ?? fromStk.amount,
      phone: parsed.phone ?? fromStk.phone,
      rawPayload: raw,
      eventType: "webhook",
      failed,
      failureReason:
        parsed.failureReason ?? parsed.ResultDesc ?? fromStk.resultDesc,
    });

    return jsonOk({
      ok: true,
      ...result,
      autoLogin: result.loginUsername
        ? {
            username: result.loginUsername,
            password: result.loginPassword,
            linkLoginOnly: result.linkLoginOnly,
          }
        : null,
    });
  } catch (error) {
    if (error instanceof PortalPaymentError) {
      return jsonError(error.message, error.status);
    }
    return handleRouteError(error);
  }
}
