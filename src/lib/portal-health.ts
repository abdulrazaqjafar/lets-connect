import { buildPortalBase } from "@/lib/connect-token";
import { prisma } from "@/lib/prisma";
import { withRouterOsApi } from "@/lib/routeros/api-client";

export type PortalHealthResult = {
  status: "OK" | "BROKEN" | "UNKNOWN";
  detail: string;
  loginHtmlUrl: string;
  portalUrl: string;
  cloudOk: boolean;
  routerPushed: boolean | null;
};

function portalUrls(siteId: string) {
  const base = buildPortalBase();
  return {
    portalUrl: `${base}/portal/${siteId}`,
    loginHtmlUrl: `${base}/api/hotspot/${siteId}/login.html`,
  };
}

/** Verify cloud login.html redirects to this site's voucher portal. */
export async function checkCloudLoginHtml(siteId: string): Promise<{
  ok: boolean;
  detail: string;
}> {
  const { portalUrl, loginHtmlUrl } = portalUrls(siteId);
  try {
    const res = await fetch(loginHtmlUrl, {
      cache: "no-store",
      headers: { Accept: "text/html" },
    });
    if (!res.ok) {
      return { ok: false, detail: `Cloud login.html HTTP ${res.status}` };
    }
    const html = await res.text();
    if (!html.includes(`/portal/${siteId}`)) {
      return {
        ok: false,
        detail: "login.html does not contain this site’s portal path",
      };
    }
    if (!html.includes("link-login-only") && !html.includes("$(mac)")) {
      return {
        ok: false,
        detail: "login.html missing MikroTik redirect variables",
      };
    }
    return {
      ok: true,
      detail: `Cloud redirect OK → ${portalUrl}`,
    };
  } catch (error) {
    return {
      ok: false,
      detail:
        error instanceof Error
          ? `Cloud check failed: ${error.message}`
          : "Cloud check failed",
    };
  }
}

/** Push login.html onto the router via RouterOS API (/tool fetch). */
export async function repushLoginHtml(siteId: string): Promise<PortalHealthResult> {
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    select: {
      id: true,
      routerHost: true,
      routerPort: true,
      routerUsername: true,
      routerPassword: true,
    },
  });
  if (!site) {
    return {
      status: "BROKEN",
      detail: "Site not found",
      ...portalUrls(siteId),
      cloudOk: false,
      routerPushed: false,
    };
  }

  const cloud = await checkCloudLoginHtml(site.id);
  const { loginHtmlUrl, portalUrl } = portalUrls(site.id);

  if (!site.routerHost || !site.routerUsername || !site.routerPassword) {
    const status = cloud.ok ? "OK" : "BROKEN";
    await prisma.site.update({
      where: { id: site.id },
      data: {
        portalRedirectStatus: status,
        portalRedirectCheckedAt: new Date(),
        portalRedirectDetail: cloud.ok
          ? `${cloud.detail}. Add router API credentials to Re-push from cloud.`
          : cloud.detail,
      },
    });
    return {
      status,
      detail: cloud.ok
        ? `${cloud.detail}. Router API not configured — paste fetch in Winbox if needed.`
        : cloud.detail,
      loginHtmlUrl,
      portalUrl,
      cloudOk: cloud.ok,
      routerPushed: null,
    };
  }

  let routerPushed = false;
  let routerDetail = "";
  try {
    await withRouterOsApi(
      {
        host: site.routerHost,
        port: site.routerPort ?? 8728,
        username: site.routerUsername,
        password: site.routerPassword,
        timeoutMs: 20000,
      },
      async (client) => {
        await client.run([
          "/tool/fetch",
          `=url=${loginHtmlUrl}`,
          "=dst-path=hotspot/login.html",
          "=keep-result=yes",
        ]);
        await client.run([
          "/tool/fetch",
          `=url=${loginHtmlUrl}`,
          "=dst-path=hotspot/rlogin.html",
          "=keep-result=yes",
        ]);
      },
    );
    routerPushed = true;
    routerDetail = "Re-pushed login.html + rlogin.html to router";
  } catch (error) {
    routerDetail =
      error instanceof Error
        ? `Router push failed: ${error.message}`
        : "Router push failed";
  }

  const status: PortalHealthResult["status"] =
    cloud.ok && routerPushed ? "OK" : cloud.ok && !routerPushed ? "BROKEN" : "BROKEN";
  const detail = [cloud.detail, routerDetail].filter(Boolean).join(" · ");

  await prisma.site.update({
    where: { id: site.id },
    data: {
      portalRedirectStatus: status === "OK" ? "OK" : "BROKEN",
      portalRedirectCheckedAt: new Date(),
      portalRedirectDetail: detail,
      routerLastSeenAt: routerPushed ? new Date() : undefined,
    },
  });

  return {
    status,
    detail,
    loginHtmlUrl,
    portalUrl,
    cloudOk: cloud.ok,
    routerPushed,
  };
}

export async function checkPortalHealth(siteId: string): Promise<PortalHealthResult> {
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    select: {
      id: true,
      routerHost: true,
      routerUsername: true,
      routerPassword: true,
    },
  });
  if (!site) {
    return {
      status: "UNKNOWN",
      detail: "Site not found",
      ...portalUrls(siteId),
      cloudOk: false,
      routerPushed: null,
    };
  }

  const cloud = await checkCloudLoginHtml(site.id);
  const { loginHtmlUrl, portalUrl } = portalUrls(site.id);
  const hasApi = Boolean(site.routerHost && site.routerUsername && site.routerPassword);

  const status: PortalHealthResult["status"] = cloud.ok
    ? "OK"
    : "BROKEN";
  const detail = cloud.ok
    ? hasApi
      ? `${cloud.detail}. Router API ready for Re-push.`
      : `${cloud.detail}. Configure Brand/API for auto Re-push.`
    : cloud.detail;

  await prisma.site.update({
    where: { id: site.id },
    data: {
      portalRedirectStatus: status,
      portalRedirectCheckedAt: new Date(),
      portalRedirectDetail: detail,
    },
  });

  return {
    status,
    detail,
    loginHtmlUrl,
    portalUrl,
    cloudOk: cloud.ok,
    routerPushed: null,
  };
}
