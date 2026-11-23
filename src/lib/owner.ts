import { headers } from "next/headers";
import { getSessionUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Resolve the current site-owner id.
 * Prefer signed session cookie, then `x-owner-id`, then DEMO_OWNER_ID.
 */
export async function getOwnerId(): Promise<string | null> {
  const fromSession = await getSessionUserId();
  if (fromSession) return fromSession;

  const headerStore = await headers();
  const fromHeader = headerStore.get("x-owner-id")?.trim();
  if (fromHeader) return fromHeader;

  const fromEnv = process.env.DEMO_OWNER_ID?.trim();
  if (fromEnv) return fromEnv;

  return null;
}

export async function requireOwner() {
  const ownerId = await getOwnerId();
  if (!ownerId) {
    return {
      ok: false as const,
      error: "Please log in or sign up to continue.",
      status: 401 as const,
    };
  }
  return { ok: true as const, ownerId };
}

export async function requireOwnedSite(siteId: string) {
  const owner = await requireOwner();
  if (!owner.ok) return owner;

  const site = await prisma.site.findFirst({
    where: { id: siteId, ownerId: owner.ownerId },
  });

  if (!site) {
    return { ok: false as const, error: "Site not found", status: 404 as const };
  }

  return { ok: true as const, ownerId: owner.ownerId, site };
}
