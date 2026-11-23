import { jsonError, jsonOk, handleRouteError } from "@/lib/api";
import { processRadiusSyncQueue } from "@/lib/radius-sync-queue";

export async function POST(request: Request) {
  try {
    const secret = process.env.CRON_SECRET?.trim();
    if (secret) {
      const header = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
      if (header !== secret) return jsonError("Unauthorized", 401);
    }

    const result = await processRadiusSyncQueue();
    return jsonOk(result);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function GET(request: Request) {
  return POST(request);
}
