import { jsonOk, handleRouteError } from "@/lib/api";
import { destroySession } from "@/lib/auth";

export async function POST() {
  try {
    await destroySession();
    return jsonOk({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
