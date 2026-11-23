import { z } from "zod";
import { jsonError, jsonOk, handleRouteError } from "@/lib/api";
import { requireOwnedSite, requireOwnerWithSubscription } from "@/lib/owner";
import { asRouteId } from "@/lib/params";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ siteId?: string }> };

const brandingSchema = z.object({
  brandName: z.string().trim().max(80).nullable().optional(),
  brandLogoUrl: z.string().url().max(500).nullable().optional().or(z.literal("")),
  brandPrimaryColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .nullable()
    .optional(),
  brandAccentColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .nullable()
    .optional(),
  brandDomain: z
    .union([
      z.literal(""),
      z
        .string()
        .trim()
        .max(120)
        .regex(
          /^[a-z0-9.-]+\.[a-z]{2,}$/i,
          "Use a hostname like wifi.yourbrand.co.tz",
        ),
    ])
    .nullable()
    .optional(),
  venueType: z
    .enum([
      "GUESTHOUSE",
      "CAFE",
      "RESTAURANT",
      "BUS",
      "CAMPUS",
      "EVENT",
      "OFFICE",
      "OTHER",
    ])
    .optional(),
  paymentProvider: z
    .enum(["SNIPPE", "SELCOM", "CLICKPESA", "AZAMPAY", "MANUAL"])
    .optional(),
  routerHost: z.string().trim().max(120).nullable().optional(),
  routerUsername: z.string().trim().max(64).nullable().optional(),
  routerPassword: z.string().trim().max(128).nullable().optional(),
  routerPort: z.number().int().min(1).max(65535).nullable().optional(),
});

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const param = asRouteId((await context.params).siteId, "siteId");
    if (!param.ok) return param.response;

    const owner = await requireOwnerWithSubscription();
    if (!owner.ok) return jsonError(owner.error, owner.status);

    const owned = await requireOwnedSite(param.id);
    if (!owned.ok) return jsonError(owned.error, owned.status);

    const values = brandingSchema.parse(await request.json());
    const logo =
      values.brandLogoUrl === "" ? null : values.brandLogoUrl;
    const domain =
      values.brandDomain === undefined
        ? undefined
        : values.brandDomain === "" || values.brandDomain === null
          ? null
          : values.brandDomain.toLowerCase();

    const site = await prisma.site.update({
      where: { id: param.id },
      data: {
        brandName: values.brandName === undefined ? undefined : values.brandName,
        brandLogoUrl: logo === undefined ? undefined : logo,
        brandPrimaryColor:
          values.brandPrimaryColor === undefined
            ? undefined
            : values.brandPrimaryColor,
        brandAccentColor:
          values.brandAccentColor === undefined
            ? undefined
            : values.brandAccentColor,
        brandDomain: domain,
        venueType: values.venueType,
        paymentProvider: values.paymentProvider,
        routerHost: values.routerHost === undefined ? undefined : values.routerHost,
        routerUsername:
          values.routerUsername === undefined ? undefined : values.routerUsername,
        routerPassword:
          values.routerPassword === undefined ? undefined : values.routerPassword,
        routerPort: values.routerPort === undefined ? undefined : values.routerPort,
      },
      select: {
        id: true,
        name: true,
        brandName: true,
        brandLogoUrl: true,
        brandPrimaryColor: true,
        brandAccentColor: true,
        brandDomain: true,
        venueType: true,
        paymentProvider: true,
        routerHost: true,
        routerUsername: true,
        routerPort: true,
        portalRedirectStatus: true,
        portalRedirectCheckedAt: true,
        portalRedirectDetail: true,
      },
    });

    return jsonOk({ site });
  } catch (error) {
    return handleRouteError(error);
  }
}
