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
  /** Enable WireGuard tunnel to cloud (RouterOS v7) */
  enableWireguard?: boolean;
  /** Cloud WireGuard public key (peer) */
  wireguardPeerPublicKey?: string;
  /** Cloud WireGuard endpoint host:port */
  wireguardEndpoint?: string;
  /** Local WireGuard address e.g. 10.66.0.2/32 */
  wireguardAddress?: string;
  /** Create dedicated RouterOS API user for Lets Connect */
  enableApiUser?: boolean;
  /** API username (default letsconnect) */
  apiUsername?: string;
  /** API password (defaults to RADIUS secret) */
  apiPassword?: string;
};

const DEFAULT_WALLED_GARDEN_HOSTS = [
  "tech-spherewifi.xyz",
  "www.tech-spherewifi.xyz",
  "azampay.co.tz",
  "www.azampay.co.tz",
  "checkout.azampay.co.tz",
  "selcom.net",
  "www.selcom.net",
  "api.selcom.net",
  "clickpesa.com",
  "www.clickpesa.com",
  "api.clickpesa.com",
  "snippe.sh",
  "api.snippe.sh",
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
  /** Site-specific voucher portal (phone must land here after Sign in) */
  const voucherPortalUrl = `${portalBase}/portal/${site.id}`;
  /** Hotspot login.html that 302/meta-redirects to voucherPortalUrl */
  const loginHtmlUrl = `${portalBase}/api/hotspot/${site.id}/login.html`;
  const iface = options.hotspotInterface ?? "bridge-hotspot";
  const wan = options.wanInterface ?? "ether1";
  const hotspotAddress = options.hotspotAddress ?? "10.5.50.1/24";
  const poolRange = options.addressPoolRange ?? "10.5.50.10-10.5.50.200";
  const authPort = options.radiusAuthPort ?? 1812;
  const acctPort = options.radiusAcctPort ?? 1813;
  const podPort = options.radiusPodPort ?? Number(process.env.RADIUS_POD_PORT ?? 3799);
  const enableWg =
    options.enableWireguard ??
    process.env.MIKROTIK_WIREGUARD_ENABLED === "true";
  const wgPeerKey = (
    options.wireguardPeerPublicKey ??
    process.env.WIREGUARD_CLOUD_PUBLIC_KEY ??
    ""
  ).trim();
  const wgEndpoint = (
    options.wireguardEndpoint ??
    process.env.WIREGUARD_CLOUD_ENDPOINT ??
    `${cloudIp}:51820`
  ).trim();
  const wgAddress = options.wireguardAddress ?? "10.66.0.2/32";
  const enableApi = options.enableApiUser !== false;
  const apiUser = options.apiUsername ?? "letsconnect";
  const apiPass = options.apiPassword ?? site.secretKey;

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
  push("# Lets Connect — One-command RouterOS v7 onboarding");
  push("# Hotspot + RADIUS + API user + optional WireGuard");
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

  push("# ============================================================");
  push("# --- 11) REDIRECT → voucher portal for THIS site ---");
  push(`# Site: ${site.name}`);
  push(`# Voucher portal URL: ${voucherPortalUrl}`);
  push(`# login.html source:  ${loginHtmlUrl}`);
  push("# Phone Sign-in opens wifi.local/login → auto-redirects to portal above");
  push("# ============================================================");
  cmd(`:local lcPortalUrl "${escapeRos(voucherPortalUrl)}"`);
  cmd(`:local lcLoginHtml "${escapeRos(loginHtmlUrl)}"`);
  cmd(`:put ("Lets Connect voucher portal: " . $lcPortalUrl)`);
  cmd(
    `:do { /ip dns static remove [find where name="wifi.local" and comment~"${escapeRos(comment)}"] } on-error={}`,
  );
  cmd(
    `/ip dns static add name=wifi.local address=${escapeRos(gwIp)} comment="${escapeRos(comment)}"`,
  );
  // Allow voucher portal host before fetching redirect page
  cmd(
    `:do { /ip hotspot walled-garden remove [find where comment="${escapeRos(`${comment} portal-redirect`)}"] } on-error={}`,
  );
  cmd(
    `/ip hotspot walled-garden add dst-host="${escapeRos(portalIp)}" action=allow comment="${escapeRos(`${comment} portal-redirect`)}" disabled=no`,
  );
  cmd(
    `:do { /ip hotspot walled-garden ip remove [find where comment="${escapeRos(`${comment} portal-redirect-ip`)}"] } on-error={}`,
  );
  cmd(
    `/ip hotspot walled-garden ip add dst-address=${escapeRos(portalIp.match(/^\d+\.\d+\.\d+\.\d+$/) ? portalIp : DEFAULT_PORTAL_IP)} action=allow comment="${escapeRos(`${comment} portal-redirect-ip`)}"`,
  );
  cmd(`:do { /ip hotspot reset-html hotspot } on-error={}`);
  // Install redirect page bound to this site's portal URL
  cmd(
    `:do { /tool fetch url=$lcLoginHtml dst-path=hotspot/login.html keep-result=yes } on-error={ :put "WARN: voucher redirect fetch failed — retrying..." }`,
  );
  cmd(`:delay 2s`);
  cmd(`/tool fetch url=$lcLoginHtml dst-path=hotspot/login.html keep-result=yes`);
  cmd(
    `:do { /tool fetch url=$lcLoginHtml dst-path=hotspot/rlogin.html keep-result=yes } on-error={}`,
  );
  cmd(
    `:do { /tool fetch url=$lcLoginHtml dst-path=hotspot/redirect.html keep-result=yes } on-error={}`,
  );
  cmd(`:put ("OK: hotspot login redirects to " . $lcPortalUrl)`);
  cmd(
    `:put ("login.html bytes: " . [/file get [/file find name="hotspot/login.html"] size])`,
  );
  push(`# Refresh redirect later (same site):`);
  push(
    `# /tool fetch url="${loginHtmlUrl}" dst-path=hotspot/login.html keep-result=yes`,
  );
  push();

  push("# --- 12) RouterOS API access (Lets Connect cloud) ---");
  if (enableApi) {
    cmd(`:do { /user group remove [find where name="letsconnect-api"] } on-error={}`);
    cmd(
      `/user group add name="letsconnect-api" policy=local,telnet,ssh,ftp,reboot,read,write,policy,test,api,!winbox,!web,!password,!sensitive,!sniff,!dude,!tikapp comment="${escapeRos(comment)}"`,
    );
    cmd(`:do { /user remove [find where name="${escapeRos(apiUser)}"] } on-error={}`);
    cmd(
      `/user add name="${escapeRos(apiUser)}" group=letsconnect-api password="${escapeRos(apiPass)}" comment="${escapeRos(comment)}"`,
    );
    cmd(`/ip service set api disabled=no`);
    cmd(
      `:do { /ip firewall filter remove [find where comment~"${escapeRos(`${comment} api`)}"] } on-error={}`,
    );
    cmd(
      `/ip firewall filter add chain=input action=accept protocol=tcp dst-port=8728 comment="${escapeRos(`${comment} api`)}" place-before=0`,
    );
    push(`# API user: ${apiUser}  (store password securely in Lets Connect site settings)`);
  } else {
    push("# API user skipped (enableApiUser=false)");
  }
  push();

  push("# --- 13) WireGuard tunnel to cloud (RouterOS v7) ---");
  if (enableWg && wgPeerKey) {
    cmd(`:do { /interface wireguard peers remove [find where interface="wg-letsconnect"] } on-error={}`);
    cmd(`:do { /interface wireguard remove [find where name="wg-letsconnect"] } on-error={}`);
    cmd(
      `/interface wireguard add name="wg-letsconnect" listen-port=13231 mtu=1420 comment="${escapeRos(comment)}"`,
    );
    cmd(
      `/ip address add address=${escapeRos(wgAddress)} interface=wg-letsconnect comment="${escapeRos(comment)}"`,
    );
    cmd(
      [
        "/interface wireguard peers add",
        'interface=wg-letsconnect',
        `public-key="${escapeRos(wgPeerKey)}"`,
        `endpoint-address=${escapeRos(wgEndpoint.split(":")[0] ?? cloudIp)}`,
        `endpoint-port=${escapeRos(wgEndpoint.split(":")[1] ?? "51820")}`,
        "allowed-address=10.66.0.0/24",
        "persistent-keepalive=25s",
        `comment="${escapeRos(comment)}"`,
      ].join(" "),
    );
    cmd(`:put ("WireGuard local public key: " . [/interface wireguard get wg-letsconnect public-key])`);
    push("# Paste the printed public key into Lets Connect site → WireGuard peer.");
  } else {
    push("# WireGuard skipped — set WIREGUARD_CLOUD_PUBLIC_KEY + MIKROTIK_WIREGUARD_ENABLED=true");
    push("# Or pass enableWireguard + wireguardPeerPublicKey when generating the script.");
  }
  push();

  push("# --- Done ---");
  cmd(
    `:put "Lets Connect ready. NAS=${escapeRos(site.nasIdentifier)} RADIUS=${escapeRos(cloudIp)}"`,
  );
  cmd(
    `:put "VOUCHER PORTAL REDIRECT: ${escapeRos(voucherPortalUrl)}"`,
  );
  cmd(
    `:put "SSID LetsConnect → Sign in → opens that portal (site ${escapeRos(site.name)})"`,
  );
  push();

  return lines.join("\r\n");
}
