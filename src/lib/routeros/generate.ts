import { prisma } from "@/lib/prisma";
import {
  getCloudConfig,
  parseSiteRouterConfig,
  resolveSiteRouterConfig,
  uniqueHosts,
} from "@/lib/routeros/config";
import { escapeRos, RouterOsScriptBuilder } from "@/lib/routeros/script-builder";
import type {
  GenerateRouterOsOptions,
  RouterOsScriptResult,
  SiteForRouterOs,
} from "@/lib/routeros/types";

/**
 * Load a site and generate a ready-to-paste RouterOS CLI script.
 * Sets up Hotspot Server, Walled Garden, and RADIUS AAA for Lets Connect.
 */
export async function generateRouterOsScriptForSite(
  siteId: string,
  options: GenerateRouterOsOptions = {},
): Promise<RouterOsScriptResult> {
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    select: {
      id: true,
      name: true,
      slug: true,
      nasIdentifier: true,
      radiusSecret: true,
      routerHost: true,
      routerConfig: true,
    },
  });

  if (!site) {
    throw new RouterOsSiteNotFoundError(siteId);
  }

  return buildRouterOsScript(site, {
    ...options,
    overrides: {
      radiusSecret: site.radiusSecret,
      ...options.overrides,
    },
  });
}

/** Pure builder — useful for tests and previews without DB. */
export function buildRouterOsScript(
  site: SiteForRouterOs,
  options: GenerateRouterOsOptions = {},
): RouterOsScriptResult {
  const cloud = getCloudConfig(options.cloud);
  const siteCfg = resolveSiteRouterConfig(
    parseSiteRouterConfig(site.routerConfig),
    options.overrides,
  );

  const radiusSecret = siteCfg.radiusSecret ?? cloud.radiusSecret;
  const portalDomain = cloud.portalDomain;
  const dnsName = siteCfg.hotspotDnsName || portalDomain;

  const walledGardenHosts = uniqueHosts(
    [portalDomain, dnsName],
    cloud.paymentGatewayHosts,
    siteCfg.extraWalledGardenHosts,
  );

  const commentPrefix = `LC:${site.nasIdentifier}`;
  const radiusIncomingComment = `${commentPrefix} radius`;
  const aaaComment = `${commentPrefix} aaa`;

  const b = new RouterOsScriptBuilder();

  b.comment("Lets Connect — MikroTik RouterOS provisioning script")
    .comment(`Site: ${site.name} (${site.id})`)
    .comment(`NAS-Identifier: ${site.nasIdentifier}`)
    .comment(`Generated: ${new Date().toISOString()}`)
    .comment("Paste into Terminal (or /system script). Review before apply.")
    .blank()
    .cmd(":put \"Lets Connect: starting hotspot provisioning...\"");

  // -------------------------------------------------------------------------
  // Cleanup previous LC objects (idempotent re-runs)
  // -------------------------------------------------------------------------
  if (!siteCfg.skipCleanup) {
    b.section("Cleanup previous Lets Connect objects")
      .removeByComment("/ip hotspot walled-garden", `${commentPrefix} wg`)
      .removeByComment("/ip hotspot walled-garden ip", `${commentPrefix} wg-ip`)
      .removeByName("/ip hotspot", siteCfg.hotspotServerName!)
      .removeByName("/ip hotspot profile", siteCfg.hotspotProfileName!)
      .removeByName("/ip pool", siteCfg.addressPoolName!)
      .removeByComment("/radius", radiusIncomingComment);
  }

  // -------------------------------------------------------------------------
  // Address pool + interface address for hotspot clients
  // -------------------------------------------------------------------------
  b.section("Hotspot address pool")
    .cmd(
      `/ip pool add name="${escapeRos(siteCfg.addressPoolName!)}" ranges=${siteCfg.addressPoolRange}`,
    )
    .comment(
      `Ensure ${siteCfg.hotspotInterface} exists and has ${siteCfg.hotspotAddress} before clients connect.`,
    )
    .cmd(
      `:do { /ip address add address=${siteCfg.hotspotAddress} interface=${escapeRos(siteCfg.hotspotInterface!)} comment="${escapeRos(commentPrefix)} gw" } on-error={}`,
    );

  // -------------------------------------------------------------------------
  // RADIUS client → cloud AAA
  // -------------------------------------------------------------------------
  b.section("RADIUS client (cloud AAA)")
    .cmd(
      [
        "/radius add",
        `comment="${escapeRos(radiusIncomingComment)}"`,
        `service=hotspot`,
        `address=${escapeRos(cloud.radiusHost)}`,
        `secret="${escapeRos(radiusSecret)}"`,
        `authentication-port=${cloud.radiusAuthPort}`,
        `accounting-port=${cloud.radiusAcctPort}`,
        `timeout=3s`,
        `protocol=udp`,
      ].join(" "),
    )
    .cmd(
      `/radius incoming set accept=yes port=${cloud.radiusAcctPort}`,
    );

  // -------------------------------------------------------------------------
  // Hotspot profile + server (AAA via RADIUS)
  // -------------------------------------------------------------------------
  b.section("Hotspot profile + server")
    .cmd(
      [
        "/ip hotspot profile add",
        `name="${escapeRos(siteCfg.hotspotProfileName!)}"`,
        `hotspot-address=${siteCfg.hotspotAddress.split("/")[0]}`,
        `dns-name="${escapeRos(dnsName)}"`,
        `html-directory=hotspot`,
        `html-directory-override=""`,
        `login-by=http-chap,http-pap,https,mac-cookie`,
        `use-radius=yes`,
        `radius-accounting=yes`,
        `radius-interim-update=5m`,
        `nas-port-type=wireless-802.11`,
      ].join(" "),
    )
    .cmd(
      [
        "/ip hotspot add",
        `name="${escapeRos(siteCfg.hotspotServerName!)}"`,
        `interface=${escapeRos(siteCfg.hotspotInterface!)}`,
        `address-pool="${escapeRos(siteCfg.addressPoolName!)}"`,
        `profile="${escapeRos(siteCfg.hotspotProfileName!)}"`,
        `idle-timeout=5m`,
        `addresses-per-mac=2`,
        `disabled=no`,
      ].join(" "),
    )
    .comment("Advertise NAS-Identifier so our RADIUS can map this router to the Site")
    .cmd(
      `/ip hotspot profile set [find name="${escapeRos(siteCfg.hotspotProfileName!)}"] ` +
        `radius-default-domain="" ` +
        `radius-location-id="${escapeRos(site.nasIdentifier)}" ` +
        `radius-location-name="${escapeRos(site.name)}"`,
    );

  // RouterOS uses /system identity + RADIUS NAS-ID from identity by default;
  // set identity to nasIdentifier for reliable Site matching.
  b.section("System identity (= NAS-Identifier)")
    .cmd(`/system identity set name="${escapeRos(site.nasIdentifier)}"`);

  // -------------------------------------------------------------------------
  // Walled Garden — portal + payment gateways
  // -------------------------------------------------------------------------
  b.section("Walled Garden (portal + payment gateways)");
  const emittedHosts = new Set<string>();
  for (const host of walledGardenHosts) {
    const aliases = [host];
    if (!host.startsWith("www.") && host.split(".").length <= 3) {
      aliases.push(`www.${host}`);
    }
    for (const alias of aliases) {
      if (emittedHosts.has(alias)) continue;
      emittedHosts.add(alias);
      b.cmd(
        [
          "/ip hotspot walled-garden add",
          `dst-host="${escapeRos(alias)}"`,
          `action=allow`,
          `comment="${escapeRos(`${commentPrefix} wg`)}"`,
          `disabled=no`,
        ].join(" "),
      );
    }
  }

  // Allow DNS so clients can resolve walled hosts before auth
  b.comment("Allow DNS through the hotspot before login")
    .cmd(
      [
        "/ip hotspot walled-garden ip add",
        `dst-port=53`,
        `protocol=udp`,
        `action=allow`,
        `comment="${escapeRos(`${commentPrefix} wg-ip`)}"`,
      ].join(" "),
    )
    .cmd(
      [
        "/ip hotspot walled-garden ip add",
        `dst-port=53`,
        `protocol=tcp`,
        `action=allow`,
        `comment="${escapeRos(`${commentPrefix} wg-ip`)}"`,
      ].join(" "),
    );

  // -------------------------------------------------------------------------
  // Hotspot user profile defaults (RADIUS still overrides session attrs)
  // -------------------------------------------------------------------------
  b.section("Hotspot AAA notes")
    .comment(`${aaaComment}: authentication & accounting go to ${cloud.radiusHost}`)
    .comment("Session limits (time/data/speed) are returned as RADIUS attributes from Lets Connect")
    .comment(
      `Captive portal URL: https://${portalDomain}/portal?nas=${site.nasIdentifier}&mac=$(mac)&ip=$(ip)&link-login-only=$(link-login-only)&link-orig=$(link-orig)`,
    )
    .comment(
      "Point Hotspot login.html (or alogin redirect) at that URL so clients land on Lets Connect.",
    )
    .cmd(
      `:put "Lets Connect: hotspot ready. Portal=${portalDomain} RADIUS=${cloud.radiusHost}"`,
    )
    .cmd(`:put "NAS-Identifier=${site.nasIdentifier}"`);

  return {
    siteId: site.id,
    siteName: site.name,
    nasIdentifier: site.nasIdentifier,
    script: b.build(),
    meta: {
      hotspotInterface: siteCfg.hotspotInterface!,
      hotspotAddress: siteCfg.hotspotAddress!,
      portalDomain,
      radiusHost: cloud.radiusHost,
      walledGardenHosts,
      generatedAt: new Date().toISOString(),
    },
  };
}

export class RouterOsSiteNotFoundError extends Error {
  constructor(siteId: string) {
    super(`Site not found: ${siteId}`);
    this.name = "RouterOsSiteNotFoundError";
  }
}
