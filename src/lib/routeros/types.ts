import type { Site } from "@prisma/client";

/** Optional per-site overrides stored in Site.routerConfig JSON */
export type SiteRouterConfig = {
  /** LAN/bridge interface that serves hotspot clients */
  hotspotInterface?: string;
  /** Hotspot gateway address on that interface (CIDR) */
  hotspotAddress?: string;
  /** DHCP pool range for hotspot clients */
  addressPoolRange?: string;
  /** Address pool name */
  addressPoolName?: string;
  /** Hotspot server profile / server names */
  hotspotProfileName?: string;
  hotspotServerName?: string;
  /** Captive-portal DNS name advertised to clients */
  hotspotDnsName?: string;
  /** Shared secret used with our cloud RADIUS (overrides env default) */
  radiusSecret?: string;
  /** Extra walled-garden hostnames for this site only */
  extraWalledGardenHosts?: string[];
  /** Skip removing existing LC-* objects before apply */
  skipCleanup?: boolean;
};

export type RouterOsCloudConfig = {
  /** Public hostname or IP of Lets Connect RADIUS */
  radiusHost: string;
  radiusAuthPort: number;
  radiusAcctPort: number;
  /** Default RADIUS shared secret (site may override) */
  radiusSecret: string;
  /** Captive portal / landing page origin host */
  portalDomain: string;
  /** Payment + CDN hosts that must bypass the hotspot login */
  paymentGatewayHosts: string[];
};

export type GenerateRouterOsOptions = {
  cloud?: Partial<RouterOsCloudConfig>;
  /** Override fields from Site.routerConfig */
  overrides?: Partial<SiteRouterConfig>;
};

export type RouterOsScriptResult = {
  siteId: string;
  siteName: string;
  nasIdentifier: string;
  script: string;
  meta: {
    hotspotInterface: string;
    hotspotAddress: string;
    portalDomain: string;
    radiusHost: string;
    walledGardenHosts: string[];
    generatedAt: string;
  };
};

export type SiteForRouterOs = Pick<
  Site,
  | "id"
  | "name"
  | "slug"
  | "nasIdentifier"
  | "radiusSecret"
  | "routerHost"
  | "routerConfig"
>;
