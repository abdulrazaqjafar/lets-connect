import { z } from "zod";

/**
 * MikroTik Hotspot redirects clients with query params such as:
 * mac, ip, username, link-login-only, link-orig, chap-id, chap-challenge, error
 * We also expect `nas` (system identity / NAS-Identifier) to resolve the Site.
 */
export const mikrotikPortalParamsSchema = z.object({
  mac: z.string().min(1, "mac is required"),
  "link-login-only": z.string().min(1, "link-login-only is required"),
  nas: z.string().min(1).optional(),
  "nas-id": z.string().min(1).optional(),
  identity: z.string().min(1).optional(),
  ip: z.string().optional(),
  "chap-id": z.string().optional(),
  "chap-challenge": z.string().optional(),
  "link-orig": z.string().optional(),
  dst: z.string().optional(),
  error: z.string().optional(),
  site: z.string().optional(),
});

export type MikrotikPortalParams = z.infer<typeof mikrotikPortalParamsSchema>;

export type ParsedPortalContext = {
  mac: string;
  linkLoginOnly: string;
  nasIdentifier: string | null;
  siteSlug: string | null;
  /** Operator custom portal host e.g. wifi.jinalake.co.tz */
  brandDomain: string | null;
  clientIp: string | null;
  chapId: string | null;
  chapChallenge: string | null;
  linkOrig: string | null;
  error: string | null;
};

export function parsePortalSearchParams(
  input: URLSearchParams | Record<string, string | string[] | undefined>,
): ParsedPortalContext {
  const raw =
    input instanceof URLSearchParams
      ? Object.fromEntries(input.entries())
      : Object.fromEntries(
          Object.entries(input).map(([key, value]) => [
            key,
            Array.isArray(value) ? value[0] : value,
          ]),
        );

  const parsed = mikrotikPortalParamsSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      mac: String(raw.mac ?? ""),
      linkLoginOnly: String(raw["link-login-only"] ?? ""),
      nasIdentifier: null,
      siteSlug: typeof raw.site === "string" ? raw.site : null,
      brandDomain: null,
      clientIp: typeof raw.ip === "string" ? raw.ip : null,
      chapId: typeof raw["chap-id"] === "string" ? raw["chap-id"] : null,
      chapChallenge:
        typeof raw["chap-challenge"] === "string" ? raw["chap-challenge"] : null,
      linkOrig:
        typeof raw["link-orig"] === "string"
          ? raw["link-orig"]
          : typeof raw.dst === "string"
            ? raw.dst
            : null,
      error: typeof raw.error === "string" ? raw.error : null,
    };
  }

  const data = parsed.data;
  return {
    mac: normalizeMac(data.mac),
    linkLoginOnly: data["link-login-only"],
    nasIdentifier: data.nas ?? data["nas-id"] ?? data.identity ?? null,
    siteSlug: data.site ?? null,
    brandDomain: null,
    clientIp: data.ip ?? null,
    chapId: data["chap-id"] ?? null,
    chapChallenge: data["chap-challenge"] ?? null,
    linkOrig: data["link-orig"] ?? data.dst ?? null,
    error: data.error ?? null,
  };
}

export function normalizeMac(mac: string): string {
  return mac.trim().toUpperCase().replace(/-/g, ":");
}

export function hasRequiredPortalParams(ctx: ParsedPortalContext): boolean {
  return Boolean(ctx.mac && ctx.linkLoginOnly);
}
