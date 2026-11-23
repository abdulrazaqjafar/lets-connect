import { createHash } from "crypto";

/** Opaque install token so routers can /tool fetch a site .rsc without session cookies. */
export function siteConnectToken(site: { id: string; radiusSecret: string }) {
  const pepper =
    process.env.CONNECT_TOKEN_PEPPER?.trim() ||
    process.env.RADIUS_SECRET?.trim() ||
    "lets-connect-install";
  return createHash("sha256")
    .update(`${site.id}:${site.radiusSecret}:${pepper}`)
    .digest("base64url")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 48);
}

export function verifySiteConnectToken(
  site: { id: string; radiusSecret: string },
  token: string,
) {
  if (!token || token.length < 16) return false;
  const expected = siteConnectToken(site);
  return expected === token;
}

export function buildPortalBase() {
  return (
    process.env.NEXT_PUBLIC_PORTAL_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "http://18.199.177.29"
  ).replace(/\/$/, "");
}

/** One-line Winbox Terminal installer (NTP → fetch .rsc → import), like ISP billing UIs. */
export function buildOneLineInstallCommand(opts: {
  siteId: string;
  token: string;
  portalBase?: string;
  /** Extra query e.g. ros=7&hotspot=1 */
  query?: string;
}) {
  const base = (opts.portalBase ?? buildPortalBase()).replace(/\/$/, "");
  const qs = opts.query?.replace(/^\?/, "") ?? "";
  const url = `${base}/api/connect/${opts.siteId}/${opts.token}/setup.rsc${qs ? `?${qs}` : ""}`;
  return [
    ':if ([/system ntp client get status]!="synchronized") do={',
    "/system ntp client set enabled=yes servers=time.cloudflare.com;",
    ":for i from=1 to=15 do={",
    ':if ([/system ntp client get status]!="synchronized") do={:delay 1s}',
    "}",
    "};",
    `/tool fetch url="${url}" dst-path=lc-setup.rsc;`,
    ':do {/import lc-setup.rsc} on-error={:put "Lets Connect setup failed — check WAN/DNS"}',
  ].join("");
}

export const ROS7_DEVICE_MODE_CMD = "/system/device-mode/update mode=advanced";
