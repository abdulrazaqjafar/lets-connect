import { z } from "zod";
import { jsonCreated, jsonError, handleRouteError } from "@/lib/api";
import {
  initiatePortalPayment,
  PortalPaymentError,
} from "@/lib/portal/payment";
import { phoneLooksValid } from "@/lib/portal/phone";

const paySchema = z.object({
  siteId: z.string().min(1),
  packageId: z.string().min(1),
  mac: z.string().min(1),
  linkLoginOnly: z.string().min(1),
  clientIp: z.string().optional().nullable(),
  chapId: z.string().optional().nullable(),
  chapChallenge: z.string().optional().nullable(),
  linkOrig: z.string().optional().nullable(),
  phone: z.string().min(9),
  provider: z.enum(["MPESA", "TIGO_PESA", "AIRTEL_MONEY"]).optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const values = paySchema.parse(body);

    if (!phoneLooksValid(values.phone)) {
      return jsonError("Enter a valid mobile money number", 400);
    }

    const result = await initiatePortalPayment({
      siteId: values.siteId,
      packageId: values.packageId,
      mac: values.mac,
      linkLoginOnly: values.linkLoginOnly,
      clientIp: values.clientIp,
      chapId: values.chapId,
      chapChallenge: values.chapChallenge,
      linkOrig: values.linkOrig,
      phone: values.phone,
      provider: values.provider ?? undefined,
    });

    return jsonCreated(result);
  } catch (error) {
    if (error instanceof PortalPaymentError) {
      return jsonError(error.message, error.status);
    }
    return handleRouteError(error);
  }
}
