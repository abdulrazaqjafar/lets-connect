import { jsonError, jsonOk, handleRouteError } from "@/lib/api";
import {
  ROS7_DEVICE_MODE_CMD,
  buildOneLineInstallCommand,
  buildPortalBase,
  siteConnectToken,
} from "@/lib/connect-token";
import { requireOwnedSite } from "@/lib/owner";
import { asRouteId } from "@/lib/params";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ siteId?: string }> };

/** Owner-facing one-line Winbox installer + advisory for a site. */
export async function GET(request: Request, context: RouteContext) {
  try {
    const param = asRouteId((await context.params).siteId, "siteId");
    if (!param.ok) return param.response;

    const owned = await requireOwnedSite(param.id);
    if (!owned.ok) return jsonError(owned.error, owned.status);

    const site = await prisma.site.findUnique({
      where: { id: param.id },
      select: { id: true, name: true, nasIdentifier: true, radiusSecret: true },
    });
    if (!site) return jsonError("Site not found", 404);

    const { searchParams } = new URL(request.url);
    const ros = searchParams.get("ros") === "6" ? 6 : 7;
    const hotspot = searchParams.get("hotspot") !== "0";
    const pppoe = searchParams.get("pppoe") === "1";
    const staticIp = searchParams.get("static") === "1";
    const radiusHost =
      searchParams.get("radiusHost")?.trim() ||
      process.env.NEXT_PUBLIC_CLOUD_RADIUS_IP?.trim() ||
      "18.199.177.29";

    const token = siteConnectToken(site);
    const portalBase = buildPortalBase();
    const qs = new URLSearchParams({
      ros: String(ros),
      hotspot: hotspot ? "1" : "0",
      pppoe: pppoe ? "1" : "0",
      static: staticIp ? "1" : "0",
      radiusHost,
    });
    const rscUrl = `${portalBase}/api/connect/${site.id}/${token}/setup.rsc?${qs.toString()}`;
    const oneLine = buildOneLineInstallCommand({
      siteId: site.id,
      token,
      portalBase,
      query: qs.toString(),
    });

    return jsonOk({
      siteId: site.id,
      siteName: site.name,
      nasIdentifier: site.nasIdentifier,
      routerOsVersion: ros,
      services: { hotspot, pppoe, staticIp },
      rscUrl,
      oneLineCommand: oneLine,
      deviceModeCommand: ros >= 7 ? ROS7_DEVICE_MODE_CMD : null,
      portalUrl: `${portalBase}/portal/${site.id}`,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
