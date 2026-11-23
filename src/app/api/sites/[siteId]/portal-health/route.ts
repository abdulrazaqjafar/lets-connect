import { jsonError, jsonOk, handleRouteError } from "@/lib/api";
import { checkPortalHealth, repushLoginHtml } from "@/lib/portal-health";
import { requireOwnedSite, requireOwnerWithSubscription } from "@/lib/owner";
import { asRouteId } from "@/lib/params";

type RouteContext = { params: Promise<{ siteId?: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const param = asRouteId((await context.params).siteId, "siteId");
    if (!param.ok) return param.response;

    const owned = await requireOwnedSite(param.id);
    if (!owned.ok) return jsonError(owned.error, owned.status);

    const health = await checkPortalHealth(param.id);
    return jsonOk({ health });
  } catch (error) {
    return handleRouteError(error);
  }
}

/** POST = Re-push login.html to the MikroTik (auto-heal captive redirect). */
export async function POST(_request: Request, context: RouteContext) {
  try {
    const param = asRouteId((await context.params).siteId, "siteId");
    if (!param.ok) return param.response;

    const owner = await requireOwnerWithSubscription();
    if (!owner.ok) return jsonError(owner.error, owner.status);

    const owned = await requireOwnedSite(param.id);
    if (!owned.ok) return jsonError(owned.error, owned.status);

    const health = await repushLoginHtml(param.id);
    return jsonOk({ health });
  } catch (error) {
    return handleRouteError(error);
  }
}
