import { jsonError, jsonOk, handleRouteError } from "@/lib/api";
import { parsePortalSearchParams, hasRequiredPortalParams } from "@/lib/portal/params";
import { listPortalPackages, resolvePortalSite } from "@/lib/portal/site";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const ctx = parsePortalSearchParams(searchParams);

    if (!hasRequiredPortalParams(ctx)) {
      return jsonError(
        "Missing MikroTik parameters. Required: mac, link-login-only",
        400,
      );
    }

    const resolved = await resolvePortalSite(ctx);
    if (!resolved) {
      return jsonError(
        "Hotspot site not found. Ensure nas= matches the router identity / NAS-Identifier.",
        404,
      );
    }
    if (!resolved.available) {
      return jsonError(resolved.reason, 403);
    }

    const site = resolved.site;
    const packages = await listPortalPackages(site.id);

    return jsonOk({
      site: {
        id: site.id,
        name: site.name,
        slug: site.slug,
        nasIdentifier: site.nasIdentifier,
      },
      context: {
        mac: ctx.mac,
        clientIp: ctx.clientIp,
        linkLoginOnly: ctx.linkLoginOnly,
        error: ctx.error,
      },
      packages,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
