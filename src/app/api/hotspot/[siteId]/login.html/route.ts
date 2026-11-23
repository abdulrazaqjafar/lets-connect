import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ siteId?: string }> };

/**
 * Public MikroTik Hotspot login.html — redirects to SaaS voucher portal.
 * Fetched by RouterOS: /tool fetch url=... dst-path=hotspot/login.html
 */
export async function GET(_request: Request, context: RouteContext) {
  const siteId = (await context.params).siteId?.trim();
  if (!siteId) {
    return new Response("Missing siteId", { status: 400 });
  }

  const site = await prisma.site.findFirst({
    where: { id: siteId, status: "ACTIVE" },
    select: { id: true, nasIdentifier: true, name: true },
  });
  if (!site) {
    return new Response("Site not found", { status: 404 });
  }

  const portalBase = (
    process.env.NEXT_PUBLIC_PORTAL_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "http://18.199.177.29"
  ).replace(/\/$/, "");

  const portalUrl =
    `${portalBase}/portal/${site.id}` +
    `?mac=$(mac)&ip=$(ip)&username=$(username)` +
    `&link-login-only=$(link-login-only)&link-orig=$(link-orig)` +
    `&nas=${encodeURIComponent(site.nasIdentifier)}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta http-equiv="refresh" content="0;url=${portalUrl}" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${site.name} · Wi‑Fi Portal</title>
  <script>window.location.replace(${JSON.stringify(portalUrl)});</script>
</head>
<body style="font-family:system-ui,sans-serif;padding:2rem;text-align:center">
  <p>Redirecting to voucher portal…</p>
  <p><a href="${portalUrl}">Continue</a></p>
</body>
</html>
`;

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
