/**
 * Lets Connect — MikroTik RouterOS Hotspot provisioning script.
 * Compatible with RouterOS 6.49+ / 7.x Winbox Terminal paste & /import .rsc
 */

export type MikrotikScriptSiteInput = {
  id: string;
  name: string;
  nasIdentifier: string;
  secretKey: string;
};

export type MikrotikScriptOptions = {
  /** FreeRADIUS / AAA public IP or hostname (required for working RADIUS) */
  cloudRadiusIp?: string;
  /** Captive portal DNS name shown to clients */
  hotspotDnsName?: string;
  /** LAN / bridge interface that serves hotspot clients */
  hotspotInterface?: string;
  /** WAN interface used for NAT masquerade */
  wanInterface?: string;
  /** Hotspot gateway CIDR on the LAN interface */
  hotspotAddress?: string;
  /** DHCP pool for hotspot clients */
  addressPoolRange?: string;
  radiusAuthPort?: number;
  radiusAcctPort?: number;
  /** RADIUS incoming / PoD port (MikroTik default 3799) */
  radiusPodPort?: number;
};

const DEFAULT_WALLED_GARDEN_HOSTS = [
  "tech-spherewifi.xyz",
  "www.tech-spherewifi.xyz",
  "azampay.co.tz",
  "www.azampay.co.tz",
  "vodacom.co.tz",
  "www.vodacom.co.tz",
  "mpesa.vodacom.co.tz",
  "tigo.co.tz",
  "www.tigo.co.tz",
  "secure.tigo.co.tz",
  "airtel.co.tz",
  "www.airtel.co.tz",
];

/** Portal host IP (captive clients reach voucher UI before auth) */
const DEFAULT_PORTAL_IP =
  process.env.NEXT_PUBLIC_CLOUD_RADIUS_IP?.trim() ||
  process.env.CLOUD_RADIUS_IP?.trim() ||
  "18.199.177.29";

function escapeRos(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function resolveCloudIp(explicit?: string): string {
  const value = (
    explicit ??
    process.env.NEXT_PUBLIC_CLOUD_RADIUS_IP ??
    process.env.CLOUD_RADIUS_IP ??
    process.env.RADIUS_HOST ??
    ""
  ).trim();

  if (!value || value === "YOUR_CLOUD_IP") {
    return "0.0.0.0";
  }
  return value;
}

/**
 * Build a Winbox-safe, copy-pasteable RouterOS setup script.
 */
export function generateMikrotikScript(
  site: MikrotikScriptSiteInput,
  options: MikrotikScriptOptions = {},
): string {
  const cloudIp = resolveCloudIp(options.cloudRadiusIp);
  const portalBase = (
    process.env.NEXT_PUBLIC_PORTAL_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    `http://${DEFAULT_PORTAL_IP}`
  ).replace(/\/$/, "");
  const portalIp = (() => {
    try {
      return new URL(portalBase).hostname;
    } catch {
      return DEFAULT_PORTAL_IP;
    }
  })();
  // Local hotspot DNS name (captive detection); voucher UI is via login.html redirect
  const dnsName = options.hotspotDnsName ?? "wifi.local";
  const loginHtmlUrl = `${portalBase}/api/hotspot/${site.id}/login.html`;
  const iface = options.hotspotInterface ?? "bridge-hotspot";
  const wan = options.wanInterface ?? "ether1";
  const hotspotAddress = options.hotspotAddress ?? "10.5.50.1/24";
  const poolRange = options.addressPoolRange ?? "10.5.50.10-10.5.50.200";
  const authPort = options.radiusAuthPort ?? 1812;
  const acctPort = options.radiusAcctPort ?? 1813;
  const podPort = options.radiusPodPort ?? Number(process.env.RADIUS_POD_PORT ?? 3799);

  const profileName = "hsprof-letsconnect";
  const serverName = "hotspot-letsconnect";
  const poolName = "hs-pool-letsconnect";
  const dhcpName = "dhcp-letsconnect";
  const comment = `LC:${site.nasIdentifier}`;
  const networkCidr = hotspotAddress.includes("/")
    ? hotspotAddress
    : `${hotspotAddress}/24`;
  const gwIp = networkCidr.split("/")[0] ?? "10.5.50.1";
  const networkBase = gwIp.split(".").slice(0, 3).join(".") + ".0/24";

  const lines: string[] = [];
  const push = (line = "") => lines.push(line);
  const cmd = (line: string) => lines.push(line);

  push("# ============================================================");
  push("# Lets Connect — MikroTik Hotspot + RADIUS");
  push(`# Site: ${site.name}`);
  push(`# NAS-Identifier: ${site.nasIdentifier}`);
  push(`# Generated: ${new Date().toISOString()}`);
  push("# Paste into Winbox > New Terminal (or Files > Import .rsc)");
  push("# ============================================================");
  push();

  if (cloudIp === "0.0.0.0") {
    push("# WARNING: Set your FreeRADIUS public IP before using RADIUS.");
    push("# Replace 0.0.0.0 below, or set CLOUD_RADIUS_IP / field in Router Setup.");
    push();
  }

  cmd(':put "Lets Connect: starting provisioning..."');
  push();

  push("# --- 1) System identity (sent as NAS-Identifier) ---");
  cmd(`/system identity set name="${escapeRos(site.nasIdentifier)}"`);
  push();

  push("# --- 2) Hotspot bridge + attach wlan1 (2.4 GHz) ---");
  cmd(
    `:if ([:len [/interface bridge find where name="${escapeRos(iface)}"]] = 0) do={ /interface bridge add name="${escapeRos(iface)}" comment="${escapeRos(comment)}" }`,
  );
  cmd(
    `:do { /interface bridge port remove [find where interface=wlan1] } on-error={}`,
  );
  cmd(
    `:do { /interface bridge port add bridge="${escapeRos(iface)}" interface=wlan1 } on-error={}`,
  );
  cmd(
    `:do { /interface wireless set wlan1 disabled=no ssid="LetsConnect" } on-error={}`,
  );
  push(
    `# Optional 5 GHz: /interface bridge port add bridge=${iface} interface=wlan2`,
  );
  push();

  push("# --- 3) Cleanup previous Lets Connect objects ---");
  cmd(
    `:do { /ip hotspot walled-garden remove [find where comment~"${escapeRos(comment)}"] } on-error={}`,
  );
  cmd(
    `:do { /ip hotspot walled-garden ip remove [find where comment~"${escapeRos(comment)}"] } on-error={}`,
  );
  cmd(
    `:do { /ip hotspot remove [find where name="${escapeRos(serverName)}"] } on-error={}`,
  );
  cmd(
    `:do { /ip hotspot profile remove [find where name="${escapeRos(profileName)}"] } on-error={}`,
  );
  cmd(
    `:do { /ip dhcp-server remove [find where name="${escapeRos(dhcpName)}"] } on-error={}`,
  );
  cmd(
    `:do { /ip dhcp-server network remove [find where comment~"${escapeRos(comment)}"] } on-error={}`,
  );
  cmd(`:do { /ip pool remove [find where name="${escapeRos(poolName)}"] } on-error={}`);
  cmd(
    `:do { /radius remove [find where comment~"${escapeRos(comment)}"] } on-error={}`,
  );
  push();

  push("# --- 4) Address pool + gateway IP ---");
  cmd(
    `/ip pool add name="${escapeRos(poolName)}" ranges=${poolRange} comment="${escapeRos(comment)}"`,
  );
  cmd(
    `:if ([:len [/ip address find where interface="${escapeRos(iface)}" and address="${escapeRos(networkCidr)}"]] = 0) do={ /ip address add address=${networkCidr} interface="${escapeRos(iface)}" comment="${escapeRos(comment)}" }`,
  );
  push();

  push("# --- 5) DHCP for hotspot clients ---");
  cmd(
    `/ip dhcp-server network add address=${networkBase} gateway=${gwIp} dns-server=${gwIp} comment="${escapeRos(comment)}"`,
  );
  cmd(
    `/ip dhcp-server add name="${escapeRos(dhcpName)}" interface="${escapeRos(iface)}" address-pool="${escapeRos(poolName)}" lease-time=1h disabled=no`,
  );
  push();

  push("# --- 6) DNS cache (clients use hotspot gateway as DNS) ---");
  cmd(`/ip dns set allow-remote-requests=yes`);
  push();

  push("# --- 7) NAT masquerade (internet via WAN) ---");
  cmd(
    `:do { /ip firewall nat remove [find where comment="${escapeRos(`${comment} nat`)}"] } on-error={}`,
  );
  cmd(
    `/ip firewall nat add chain=srcnat out-interface="${escapeRos(wan)}" action=masquerade comment="${escapeRos(`${comment} nat`)}"`,
  );
  push(
    `# If WAN is not "${wan}", change out-interface above (ether1 / pppoe-out1 / lte1).`,
  );
  push();

  push("# --- 8) RADIUS client → Lets Connect AAA ---");
  cmd(
    [
      "/radius add",
      `address=${escapeRos(cloudIp)}`,
      `secret="${escapeRos(site.secretKey)}"`,
      "service=hotspot",
      `authentication-port=${authPort}`,
      `accounting-port=${acctPort}`,
      "timeout=3s",
      `comment="${escapeRos(`${comment} radius`)}"`,
    ].join(" "),
  );
  // PoD / Disconnect-Request listens on 3799 (not accounting port)
  cmd(`/radius incoming set accept=yes port=${podPort}`);
  push();

  push("# --- 9) Hotspot profile + server ---");
  cmd(
    [
      "/ip hotspot profile add",
      `name="${escapeRos(profileName)}"`,
      `hotspot-address=${gwIp}`,
      `dns-name="${escapeRos(dnsName)}"`,
      "html-directory=hotspot",
      "login-by=http-chap,http-pap,mac-cookie",
      "use-radius=yes",
      "radius-accounting=yes",
      "radius-interim-update=5m",
      `radius-location-id="${escapeRos(site.nasIdentifier)}"`,
      `radius-location-name="${escapeRos(site.name)}"`,
    ].join(" "),
  );
  cmd(
    [
      "/ip hotspot add",
      `name="${escapeRos(serverName)}"`,
      `interface="${escapeRos(iface)}"`,
      `address-pool="${escapeRos(poolName)}"`,
      `profile="${escapeRos(profileName)}"`,
      "idle-timeout=5m",
      "addresses-per-mac=2",
      "disabled=no",
    ].join(" "),
  );
  push();

  push("# --- 10) Walled Garden (portal + mobile money) ---");
  for (const host of DEFAULT_WALLED_GARDEN_HOSTS) {
    cmd(
      `/ip hotspot walled-garden add dst-host="${escapeRos(host)}" action=allow comment="${escapeRos(`${comment} wg`)}" disabled=no`,
    );
  }
  // Allow SaaS host by name and by IP (HTTP portal before auth)
  if (portalIp && portalIp !== "tech-spherewifi.xyz") {
    cmd(
      `/ip hotspot walled-garden add dst-host="${escapeRos(portalIp)}" action=allow comment="${escapeRos(`${comment} wg`)}" disabled=no`,
    );
  }
  cmd(
    `/ip hotspot walled-garden ip add dst-address=${escapeRos(DEFAULT_PORTAL_IP)} action=allow comment="${escapeRos(`${comment} portal-ip`)}"`,
  );
  cmd(
    `/ip hotspot walled-garden ip add dst-port=53 protocol=udp action=allow comment="${escapeRos(`${comment} dns`)}"`,
  );
  cmd(
    `/ip hotspot walled-garden ip add dst-port=53 protocol=tcp action=allow comment="${escapeRos(`${comment} dns`)}"`,
  );
  push();

  push("# --- 11) Captive login → voucher portal (SaaS) ---");
  cmd(`:do { /ip hotspot reset-html hotspot } on-error={}`);
  cmd(
    `/tool fetch url="${escapeRos(loginHtmlUrl)}" dst-path=hotspot/login.html keep-result=yes`,
  );
  push(`# Portal URL: ${portalBase}/portal/${site.id}`);
  push();

  push("# --- Done ---");
  cmd(
    `:put "Lets Connect ready. NAS=${escapeRos(site.nasIdentifier)} RADIUS=${escapeRos(cloudIp)}"`,
  );
  cmd(
    `:put "Voucher portal: ${escapeRos(portalBase)}/portal/${escapeRos(site.id)}"`,
  );
  cmd(
    `:put "Connect a phone to SSID LetsConnect — browser should open the portal."`,
  );
  push();

  return lines.join("\r\n");
}
