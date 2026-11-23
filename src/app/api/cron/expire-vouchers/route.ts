import { jsonError, jsonOk, handleRouteError } from "@/lib/api";
import { expireDueVouchers } from "@/lib/radius";

/**
 * GET|POST /api/cron/expire-vouchers
 *
 * Periodic job: mark due vouchers EXPIRED, remove FreeRADIUS rows,
 * and issue RADIUS Disconnect-Request (PoD) on UDP 3799 to MikroTik.
 *
 * Protect with CRON_SECRET / Authorization: Bearer …
 * Compatible with Vercel Cron, GitHub Actions, or `npm run radius:worker`.
 */
async function runExpire(request: Request) {
  const secret =
    process.env.CRON_SECRET ?? process.env.RADIUS_SUPERVISOR_SECRET;
  if (secret) {
    const header =
      request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
      request.headers.get("x-cron-secret") ??
      request.headers.get("x-supervisor-secret");
    if (header !== secret) {
      return jsonError("Unauthorized", 401);
    }
  }

  const result = await expireDueVouchers(200);
  return jsonOk({
    ok: true,
    at: new Date().toISOString(),
    ...result,
  });
}

export async function GET(request: Request) {
  try {
    return await runExpire(request);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    return await runExpire(request);
  } catch (error) {
    return handleRouteError(error);
  }
}
