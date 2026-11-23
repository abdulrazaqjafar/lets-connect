import { headers } from "next/headers";
import { getCurrentUser, getSessionUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireActiveSubscription } from "@/lib/subscriptions";

/**
 * Resolve the current site-owner id.
 * Prefer signed session cookie, then `x-owner-id`, then DEMO_OWNER_ID.
 * Cashiers resolve to their parent ownerId for subscription checks.
 */
export async function getOwnerId(): Promise<string | null> {
  const fromSession = await getSessionUserId();
  if (fromSession) {
    const user = await prisma.user.findFirst({
      where: { id: fromSession, isActive: true },
      select: { id: true, role: true, ownerId: true },
    });
    if (!user) return null;
    if (user.role === "CASHIER") return user.ownerId;
    return user.id;
  }

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

/** Site owner (not cashier) with active subscription — for sites/packages/staff admin. */
export async function requireOwnerWithSubscription() {
  const user = await getCurrentUser();
  if (!user) {
    return {
      ok: false as const,
      error: "Please log in or sign up to continue.",
      status: 401 as const,
    };
  }
  if (user.role === "CASHIER") {
    return {
      ok: false as const,
      error: "Cashiers can only manage cash vouchers.",
      status: 403 as const,
    };
  }

  const access = await requireActiveSubscription(user.id);
  if (!access.ok) {
    return {
      ok: false as const,
      error: access.reason,
      status: access.status,
      locked: true as const,
    };
  }

  return {
    ok: true as const,
    ownerId: user.id,
    subscription: access.subscription,
  };
}

export async function requireOwnedSite(siteId: string) {
  const gated = await requireOwnerWithSubscription();
  if (!gated.ok) return gated;

  const sessionUser = await getCurrentUser();
  if (sessionUser?.role === "CASHIER") {
    const assigned = await prisma.cashierSite.findFirst({
      where: { cashierId: sessionUser.id, siteId },
      include: { site: true },
    });
    if (!assigned || assigned.site.ownerId !== gated.ownerId) {
      return { ok: false as const, error: "Site not found", status: 404 as const };
    }
    return {
      ok: true as const,
      ownerId: gated.ownerId,
      site: assigned.site,
      cashierId: sessionUser.id,
    };
  }

  const site = await prisma.site.findFirst({
    where: { id: siteId, ownerId: gated.ownerId },
  });

  if (!site) {
    return { ok: false as const, error: "Site not found", status: 404 as const };
  }

  return { ok: true as const, ownerId: gated.ownerId, site };
}

/** Billing APIs: logged-in owner only (not cashier), no subscription required. */
export async function requireBillingOwner() {
  const user = await getCurrentUser();
  if (!user) {
    return {
      ok: false as const,
      error: "Please log in or sign up to continue.",
      status: 401 as const,
    };
  }
  if (user.role === "CASHIER") {
    return {
      ok: false as const,
      error: "Cashiers cannot manage subscriptions.",
      status: 403 as const,
    };
  }
  return { ok: true as const, ownerId: user.id, user };
}
