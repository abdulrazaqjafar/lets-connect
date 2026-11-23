import { jsonError, jsonOk, handleRouteError } from "@/lib/api";
import { runSessionSupervisor } from "@/lib/radius/session-supervisor";

/**
 * POST /api/radius/supervisor
 * Run one expiry + disconnect cycle (for cron / manual ops).
 * Protect with RADIUS_SUPERVISOR_SECRET when set.
 */
export async function POST(request: Request) {
  try {
    const secret = process.env.RADIUS_SUPERVISOR_SECRET;
    if (secret) {
      const header =
        request.headers.get("x-supervisor-secret") ??
        request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
      if (header !== secret) {
        return jsonError("Unauthorized", 401);
      }
    }

    const result = await runSessionSupervisor();
    return jsonOk(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
