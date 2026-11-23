import { jsonError, jsonOk, handleRouteError } from "@/lib/api";
import { requireOwnedSite } from "@/lib/owner";
import { asRouteId } from "@/lib/params";
import {
  generateRouterOsScriptForSite,
  RouterOsSiteNotFoundError,
} from "@/lib/routeros";

type RouteContext = { params: Promise<{ siteId?: string }> };

/**
 * GET /api/sites/[siteId]/routeros
 * Returns a dynamic RouterOS CLI script for Hotspot + Walled Garden + RADIUS AAA.
 *
 * Query:
 *  - format=txt → plain-text .rsc body (for download / Terminal paste)
 *  - format=json (default) → { script, meta, ... }
 */
export async function GET(request: Request, context: RouteContext) {
  try {
    const param = asRouteId((await context.params).siteId, "siteId");
    if (!param.ok) return param.response;

    const owned = await requireOwnedSite(param.id);
    if (!owned.ok) return jsonError(owned.error, owned.status);

    const result = await generateRouterOsScriptForSite(param.id);
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") ?? "json";

    if (format === "txt" || format === "rsc") {
      const filename = `lets-connect-${result.nasIdentifier}.rsc`;
      return new Response(result.script, {
        status: 200,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": "no-store",
        },
      });
    }

    return jsonOk(result);
  } catch (error) {
    if (error instanceof RouterOsSiteNotFoundError) {
      return jsonError(error.message, 404);
    }
    return handleRouteError(error);
  }
}
