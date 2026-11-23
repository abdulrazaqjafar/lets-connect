import { jsonError, jsonOk, handleRouteError } from "@/lib/api";
import { asRouteId } from "@/lib/params";
import {
  getPortalPaymentStatus,
  PortalPaymentError,
} from "@/lib/portal/payment";

type RouteContext = { params: Promise<{ paymentId?: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const param = asRouteId((await context.params).paymentId, "paymentId");
    if (!param.ok) return param.response;

    const status = await getPortalPaymentStatus(param.id);
    return jsonOk(status);
  } catch (error) {
    if (error instanceof PortalPaymentError) {
      return jsonError(error.message, error.status);
    }
    return handleRouteError(error);
  }
}
