import { jsonOk, handleRouteError } from "@/lib/api";
import { listPaymentGateways } from "@/lib/payments/registry";

export async function GET() {
  try {
    return jsonOk({ gateways: listPaymentGateways() });
  } catch (error) {
    return handleRouteError(error);
  }
}