import { jsonError, jsonOk, handleRouteError } from "@/lib/api";
import { getOwnerAnalytics } from "@/lib/analytics";
import { getOwnerId } from "@/lib/owner";

/**
 * GET /api/analytics — owner KPIs for the overview dashboard.
 */
export async function GET() {
  try {
    const ownerId = await getOwnerId();
    if (!ownerId) {
      return jsonError(
        "Owner not configured. Set DEMO_OWNER_ID or seed the DB.",
        401,
      );
    }

    const analytics = await getOwnerAnalytics(ownerId);
    return jsonOk(analytics);
  } catch (error) {
    return handleRouteError(error);
  }
}
