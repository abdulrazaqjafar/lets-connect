import { z } from "zod";
import { jsonCreated, jsonError, handleRouteError } from "@/lib/api";
import { asRouteId } from "@/lib/params";
import {
  initiatePortalPayment,
  PortalPaymentError,
} from "@/lib/portal/payment";
import { phoneLooksValid } from "@/lib/portal/phone";

type RouteContext = { params: Promise<{ siteId?: string }> };

const paySchema = z.object({
  packageId: z.string().min(1),
  mac: z.string().min(1),
  linkLoginOnly: z.string().min(1),
  ip: z.string().optional().nullable(),
  "user-data": z.string().optional().nullable(),
  userData: z.string().optional().nullable(),
  phone: z.string().min(9),
  provider: z.enum(["MPESA", "TIGO_PESA", "AIRTEL_MONEY"]).optional(),
});

export async function POST(request: Request, context: RouteContext) {
  try {
    const param = asRouteId((await context.params).siteId, "siteId");
    if (!param.ok) return param.response;

    const body = await request.json();
    const values = paySchema.parse(body);

    if (!phoneLooksValid(values.phone)) {
      return jsonError("Enter a valid mobile money number", 400);
    }

    const result = await initiatePortalPayment({
      siteId: param.id,
      packageId: values.packageId,
      mac: values.mac,
      linkLoginOnly: values.linkLoginOnly,
      clientIp: values.ip,
      userData: values.userData ?? values["user-data"],
      phone: values.phone,
      provider: values.provider,
    });

    return jsonCreated(result);
  } catch (error) {
    if (error instanceof PortalPaymentError) {
      return jsonError(error.message, error.status);
    }
    return handleRouteError(error);
  }
}
