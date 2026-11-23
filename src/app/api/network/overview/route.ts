import { jsonError, jsonOk, handleRouteError } from "@/lib/api";
import { getNetworkOverview } from "@/lib/network-overview";
import { requireOwnerWithSubscription } from "@/lib/owner";

export async function GET() {
  try {
    const owner = await requireOwnerWithSubscription();
    if (!owner.ok) return jsonError(owner.error, owner.status);

    const overview = await getNetworkOverview(owner.ownerId);
    return jsonOk(overview);
  } catch (error) {
    return handleRouteError(error);
  }
}
