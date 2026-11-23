import { z } from "zod";
import { jsonError, jsonOk, handleRouteError } from "@/lib/api";
import { asRouteId } from "@/lib/params";
import { PortalPaymentError } from "@/lib/portal/errors";
import { redeemCashVoucher } from "@/lib/portal/voucher-login";

type RouteContext = { params: Promise<{ siteId?: string }> };

const voucherSchema = z.object({
  code: z.string().min(4),
  mac: z.string().optional().nullable(),
  ip: z.string().optional().nullable(),
  linkLoginOnly: z.string().optional().nullable(),
  "link-login-only": z.string().optional().nullable(),
  userData: z.string().optional().nullable(),
  "user-data": z.string().optional().nullable(),
});

export async function POST(request: Request, context: RouteContext) {
  try {
    const param = asRouteId((await context.params).siteId, "siteId");
    if (!param.ok) return param.response;

    const body = await request.json();
    const values = voucherSchema.parse(body);

    const result = await redeemCashVoucher({
      siteId: param.id,
      code: values.code,
      mac: values.mac,
      clientIp: values.ip,
      linkLoginOnly: values.linkLoginOnly ?? values["link-login-only"],
      userData: values.userData ?? values["user-data"],
    });

    return jsonOk(result);
  } catch (error) {
    if (error instanceof PortalPaymentError) {
      return jsonError(error.message, error.status);
    }
    return handleRouteError(error);
  }
}
