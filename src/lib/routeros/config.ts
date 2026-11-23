import type { SiteRouterConfig, RouterOsCloudConfig } from "@/lib/routeros/types";

const DEFAULT_PAYMENT_GATEWAY_HOSTS = [
  // M-Pesa / Safaricom
  "safaricom.co.ke",
  "mpesa.safaricom.co.ke",
  // Stripe
  "stripe.com",
  "js.stripe.com",
  "api.stripe.com",
  "checkout.stripe.com",
  "m.stripe.network",
  // Paystack
  "paystack.com",
  "api.paystack.co",
  "checkout.paystack.com",
  // Flutterwave
  "flutterwave.com",
  "api.flutterwave.com",
  "checkout.flutterwave.com",
  // Common CDNs used by portals / gateways
  "cdn.jsdelivr.net",
  "fonts.googleapis.com",
  "fonts.gstatic.com",
];

export function getCloudConfig(
  overrides?: Partial<RouterOsCloudConfig>,
): RouterOsCloudConfig {
  const fromEnvHosts = process.env.PAYMENT_GATEWAY_HOSTS?.split(",")
    .map((h) => h.trim())
    .filter(Boolean);

  return {
    radiusHost:
      overrides?.radiusHost ??
      process.env.RADIUS_HOST ??
      process.env.NEXT_PUBLIC_CLOUD_RADIUS_IP ??
      process.env.NEXT_PUBLIC_APP_HOST ??
      "18.199.177.29",
    radiusAuthPort:
      overrides?.radiusAuthPort ??
      Number(process.env.RADIUS_AUTH_PORT ?? 1812),
    radiusAcctPort:
      overrides?.radiusAcctPort ??
      Number(process.env.RADIUS_ACCT_PORT ?? 1813),
    radiusSecret:
      overrides?.radiusSecret ??
      process.env.RADIUS_SECRET ??
      "changeme-lets-connect",
    portalDomain:
      overrides?.portalDomain ??
      process.env.PORTAL_DOMAIN ??
      process.env.NEXT_PUBLIC_APP_HOST ??
      "tech-spherewifi.xyz",
    paymentGatewayHosts:
      overrides?.paymentGatewayHosts ??
      (fromEnvHosts?.length ? fromEnvHosts : DEFAULT_PAYMENT_GATEWAY_HOSTS),
  };
}

export function parseSiteRouterConfig(raw: unknown): SiteRouterConfig {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  return raw as SiteRouterConfig;
}

export function resolveSiteRouterConfig(
  siteConfig: SiteRouterConfig,
  overrides?: Partial<SiteRouterConfig>,
): Required<
  Pick<
    SiteRouterConfig,
    | "hotspotInterface"
    | "hotspotAddress"
    | "addressPoolRange"
    | "addressPoolName"
    | "hotspotProfileName"
    | "hotspotServerName"
    | "hotspotDnsName"
    | "skipCleanup"
  >
> &
  SiteRouterConfig {
  const merged = { ...siteConfig, ...overrides };

  return {
    hotspotInterface: merged.hotspotInterface ?? "bridge-hotspot",
    hotspotAddress: merged.hotspotAddress ?? "10.5.50.1/24",
    addressPoolRange: merged.addressPoolRange ?? "10.5.50.2-10.5.50.254",
    addressPoolName: merged.addressPoolName ?? "hs-pool-lc",
    hotspotProfileName: merged.hotspotProfileName ?? "hsprof-lc",
    hotspotServerName: merged.hotspotServerName ?? "hotspot-lc",
    hotspotDnsName: merged.hotspotDnsName ?? "",
    radiusSecret: merged.radiusSecret,
    extraWalledGardenHosts: merged.extraWalledGardenHosts ?? [],
    skipCleanup: merged.skipCleanup ?? false,
  };
}

/** Normalize hostname for RouterOS dst-host (strip scheme/path/port). */
export function normalizeHost(input: string): string | null {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;

  try {
    const withScheme = trimmed.includes("://") ? trimmed : `https://${trimmed}`;
    const url = new URL(withScheme);
    return url.hostname || null;
  } catch {
    return trimmed.replace(/\/.*$/, "").replace(/:\d+$/, "") || null;
  }
}

export function uniqueHosts(...groups: Array<string[] | undefined>): string[] {
  const set = new Set<string>();
  for (const group of groups) {
    for (const host of group ?? []) {
      const normalized = normalizeHost(host);
      if (normalized) set.add(normalized);
    }
  }
  return Array.from(set).sort();
}
