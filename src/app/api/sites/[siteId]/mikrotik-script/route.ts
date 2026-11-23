import { jsonError, jsonOk, handleRouteError } from "@/lib/api";
import { generateMikrotikScript } from "@/lib/mikrotik-script";
import { requireOwnedSite } from "@/lib/owner";
import { asRouteId } from "@/lib/params";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ siteId?: string }> };

/**
 * GET /api/sites/[siteId]/mikrotik-script
 * Query: radiusHost, lanInterface, wanInterface
 */
export async function GET(request: Request, context: RouteContext) {
  try {
    const param = asRouteId((await context.params).siteId, "siteId");
    if (!param.ok) return param.response;

    const owned = await requireOwnedSite(param.id);
    if (!owned.ok) return jsonError(owned.error, owned.status);

    const site = await prisma.site.findUnique({
      where: { id: param.id },
      select: {
        id: true,
        name: true,
        nasIdentifier: true,
        radiusSecret: true,
        routerHost: true,
      },
    });
    if (!site) return jsonError("Site not found", 404);

    const { searchParams } = new URL(request.url);
    const radiusHost =
      searchParams.get("radiusHost")?.trim() ||
      process.env.CLOUD_RADIUS_IP?.trim() ||
      process.env.NEXT_PUBLIC_CLOUD_RADIUS_IP?.trim() ||
      process.env.RADIUS_HOST?.trim() ||
      site.routerHost?.trim() ||
      "";
    const lanInterface =
      searchParams.get("lanInterface")?.trim() || "bridge-hotspot";
    const wanInterface = searchParams.get("wanInterface")?.trim() || "ether1";

    const portalBase = (
      process.env.NEXT_PUBLIC_PORTAL_URL?.trim() ||
      process.env.NEXT_PUBLIC_APP_URL?.trim() ||
      "http://18.199.177.29"
    ).replace(/\/$/, "");

    const script = generateMikrotikScript(
      {
        id: site.id,
        name: site.name,
        nasIdentifier: site.nasIdentifier,
        secretKey: site.radiusSecret,
      },
      {
        cloudRadiusIp: radiusHost || undefined,
        hotspotInterface: lanInterface,
        wanInterface,
      },
    );

    return jsonOk({
      siteId: site.id,
      nasIdentifier: site.nasIdentifier,
      radiusHost: radiusHost || null,
      lanInterface,
      wanInterface,
      portalUrl: `${portalBase}/portal/${site.id}`,
      script,
      warnings: [
        !radiusHost
          ? "RADIUS host is empty — set Cloud RADIUS IP to 18.199.177.29 before applying."
          : null,
        `Script attaches wlan1 to "${lanInterface}" and fetches voucher login.html from the cloud.`,
        `Confirm WAN interface is "${wanInterface}" for NAT (change if you use pppoe-out1).`,
        `After apply: phone on Wi‑Fi should open ${portalBase}/portal/${site.id}`,
      ].filter(Boolean),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
