import { siteConnectToken, verifySiteConnectToken } from "@/lib/connect-token";
import { generateMikrotikScript } from "@/lib/mikrotik-script";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ siteId?: string; token?: string }>;
};

/**
 * Public RouterOS installer for a site (fetched by MikroTik /tool fetch).
 * Auth = opaque connect token derived from site id + RADIUS secret.
 */
export async function GET(request: Request, context: RouteContext) {
  const { siteId, token } = await context.params;
  if (!siteId?.trim() || !token?.trim()) {
    return new Response("# Missing site or token\r\n", {
      status: 400,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const site = await prisma.site.findFirst({
    where: { id: siteId.trim(), status: "ACTIVE" },
    select: {
      id: true,
      name: true,
      nasIdentifier: true,
      radiusSecret: true,
      routerHost: true,
    },
  });

  if (!site || !verifySiteConnectToken(site, token.trim())) {
    return new Response('# Invalid install link\r\n:put "Lets Connect: invalid token"\r\n', {
      status: 403,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const { searchParams } = new URL(request.url);
  const radiusHost =
    searchParams.get("radiusHost")?.trim() ||
    process.env.CLOUD_RADIUS_IP?.trim() ||
    process.env.NEXT_PUBLIC_CLOUD_RADIUS_IP?.trim() ||
    "18.199.177.29";
  const ros = searchParams.get("ros") === "6" ? 6 : 7;
  const hotspot = searchParams.get("hotspot") !== "0";
  const pppoe = searchParams.get("pppoe") === "1";
  const staticIp = searchParams.get("static") === "1";

  const script = generateMikrotikScript(
    {
      id: site.id,
      name: site.name,
      nasIdentifier: site.nasIdentifier,
      secretKey: site.radiusSecret,
    },
    {
      cloudRadiusIp: radiusHost,
      routerOsVersion: ros,
      enableHotspot: hotspot,
      enablePppoe: pppoe,
      enableStaticIp: staticIp,
    },
  );

  // Touch expected token into comment for support
  const header = `# connect-token ${siteConnectToken(site)}\r\n`;

  return new Response(header + script, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="lets-connect-${site.nasIdentifier}.rsc"`,
      "Cache-Control": "no-store",
    },
  });
}
