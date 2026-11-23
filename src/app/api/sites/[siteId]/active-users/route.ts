import { jsonError, jsonOk, handleRouteError } from "@/lib/api";
import { requireOwnedSite } from "@/lib/owner";
import { asRouteId } from "@/lib/params";
import { getActiveUsersForSite } from "@/lib/radius";

type RouteContext = { params: Promise<{ siteId?: string }> };

/**
 * GET /api/sites/[siteId]/active-users
 * Live Hotspot sessions from FreeRADIUS radacct (acctstoptime IS NULL).
 */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const param = asRouteId((await context.params).siteId, "siteId");
    if (!param.ok) return param.response;

    const owned = await requireOwnedSite(param.id);
    if (!owned.ok) return jsonError(owned.error, owned.status);

    const users = await getActiveUsersForSite(param.id);

    return jsonOk({
      siteId: param.id,
      count: users.length,
      users: users.map((u) => ({
        username: u.username,
        mac: u.mac,
        ip: u.framedIp,
        nasIp: u.nasIp,
        sessionId: u.sessionId,
        startedAt: u.startedAt,
        sessionTimeSec: u.sessionTime,
        bytesIn: u.inputOctets?.toString() ?? null,
        bytesOut: u.outputOctets?.toString() ?? null,
      })),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
