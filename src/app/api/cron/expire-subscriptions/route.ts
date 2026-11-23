import { jsonError, jsonOk, handleRouteError } from "@/lib/api";
import { expireAllStaleSubscriptions } from "@/lib/subscriptions";

/**
 * POST /api/cron/expire-subscriptions
 * Header: x-cron-secret or Authorization: Bearer <CRON_SECRET>
 */
export async function POST(request: Request) {
  try {
    const secret =
      process.env.CRON_SECRET?.trim() ||
      process.env.RADIUS_SUPERVISOR_SECRET?.trim() ||
      "";
    const header =
      request.headers.get("x-cron-secret")?.trim() ||
      request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ||
      "";
    if (!secret || header !== secret) {
      return jsonError("Unauthorized", 401);
    }

    const result = await expireAllStaleSubscriptions();
    return jsonOk(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
