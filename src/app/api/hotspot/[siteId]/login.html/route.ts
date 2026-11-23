import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ siteId?: string }> };

/**
 * MikroTik Hotspot login.html — served from the router after /tool fetch.
 * RouterOS substitutes $(mac), $(ip), $(link-login-only), … before the phone sees it.
 *
 * Captive-portal WebViews often block JS; prefer GET form auto-submit + meta refresh.
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

  const portalPath = `${portalBase}/portal/${site.id}`;
  const siteName = escapeHtml(site.name);
  const nas = escapeHtml(site.nasIdentifier);

  // MikroTik variables stay as $(…) literals — RouterOS expands them when serving.
  // Use *-esc where available so & / ? in values do not break the query string.
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
  <meta http-equiv="pragma" content="no-cache" />
  <meta http-equiv="expires" content="-1" />
  <title>${siteName} · Wi‑Fi</title>
  <meta http-equiv="refresh" content="0;url=${portalPath}?mac=$(mac)&amp;ip=$(ip)&amp;username=$(username-esc)&amp;link-login-only=$(link-login-only)&amp;link-orig=$(link-orig-esc)&amp;chap-id=$(chap-id)&amp;chap-challenge=$(chap-challenge)&amp;nas=${encodeURIComponent(site.nasIdentifier)}" />
  <style>
    body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
      font-family:system-ui,-apple-system,sans-serif;background:#061018;color:#e2e8f0;padding:1.5rem;text-align:center}
    .box{max-width:22rem}
    h1{font-size:1.25rem;margin:0 0 .5rem;font-weight:600}
    p{margin:0;font-size:.9rem;color:#94a3b8;line-height:1.45}
    button,a.btn{display:inline-block;margin-top:1.25rem;padding:.85rem 1.25rem;border:0;border-radius:.85rem;
      background:#14b8a6;color:#042f2e;font-weight:600;font-size:.95rem;text-decoration:none;cursor:pointer}
    .err{margin-top:1rem;color:#fecaca;font-size:.8rem}
  </style>
</head>
<body>
  <div class="box">
    <h1>${siteName}</h1>
    <p>Opening the voucher portal…</p>
    $(if error)
    <p class="err">$(error)</p>
    $(endif)
    <form id="f" method="get" action="${portalPath}">
      <input type="hidden" name="mac" value="$(mac)" />
      <input type="hidden" name="ip" value="$(ip)" />
      <input type="hidden" name="username" value="$(username)" />
      <input type="hidden" name="link-login-only" value="$(link-login-only)" />
      <input type="hidden" name="link-orig" value="$(link-orig)" />
      <input type="hidden" name="chap-id" value="$(chap-id)" />
      <input type="hidden" name="chap-challenge" value="$(chap-challenge)" />
      <input type="hidden" name="nas" value="${nas}" />
      <button type="submit" class="btn">Continue to Wi‑Fi portal</button>
    </form>
  </div>
  <script>
    try { document.getElementById("f").submit(); } catch (e) {}
  </script>
</body>
</html>
`;

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
