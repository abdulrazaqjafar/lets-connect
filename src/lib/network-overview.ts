import { prisma } from "@/lib/prisma";
import { getActiveUsersForSite } from "@/lib/radius";
import { withRouterOsApi } from "@/lib/routeros/api-client";

export type LiveSessionRow = {
  siteId: string;
  siteName: string;
  username: string;
  mac: string | null;
  ip: string | null;
  sessionTimeSec: number | null;
  bytesIn: string | null;
  bytesOut: string | null;
  startedAt: Date | null;
};

export type RouterHealthRow = {
  siteId: string;
  siteName: string;
  host: string | null;
  status: "online" | "offline" | "unconfigured";
  lastSeenAt: string | null;
  uptime?: string | null;
  cpuLoad?: string | null;
  freeMemory?: string | null;
  version?: string | null;
  error?: string | null;
};

export type CollectionRow = {
  id: string;
  siteId: string;
  siteName: string;
  amount: number;
  currency: string;
  provider: string;
  status: string;
  paidAt: string | null;
  createdAt: string;
};

export type NetworkOverview = {
  totals: {
    activeSessions: number;
    bytesIn: string;
    bytesOut: string;
    collectionsTodayTzs: number;
    routersOnline: number;
    routersTotal: number;
  };
  sessions: LiveSessionRow[];
  routers: RouterHealthRow[];
  collections: CollectionRow[];
};

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

async function probeRouterHealth(site: {
  id: string;
  name: string;
  routerHost: string | null;
  routerPort: number | null;
  routerUsername: string | null;
  routerPassword: string | null;
  routerLastSeenAt: Date | null;
}): Promise<RouterHealthRow> {
  if (!site.routerHost || !site.routerUsername || !site.routerPassword) {
    return {
      siteId: site.id,
      siteName: site.name,
      host: site.routerHost,
      status: "unconfigured",
      lastSeenAt: site.routerLastSeenAt?.toISOString() ?? null,
    };
  }

  try {
    const health = await withRouterOsApi(
      {
        host: site.routerHost,
        port: site.routerPort ?? 8728,
        username: site.routerUsername,
        password: site.routerPassword,
        timeoutMs: 4000,
      },
      async (client) => {
        const rows = await client.run([
          "/system/resource/print",
          "=.proplist=uptime,cpu-load,free-memory,version",
        ]);
        const map: Record<string, string> = {};
        for (const reply of rows) {
          for (const word of reply) {
            if (!word.startsWith("=")) continue;
            const eq = word.indexOf("=", 1);
            if (eq === -1) continue;
            map[word.slice(1, eq)] = word.slice(eq + 1);
          }
        }
        return map;
      },
    );

    const now = new Date();
    await prisma.site.update({
      where: { id: site.id },
      data: {
        routerLastSeenAt: now,
        routerHealthJson: health,
      },
    });

    return {
      siteId: site.id,
      siteName: site.name,
      host: site.routerHost,
      status: "online",
      lastSeenAt: now.toISOString(),
      uptime: health.uptime ?? null,
      cpuLoad: health["cpu-load"] ?? null,
      freeMemory: health["free-memory"] ?? null,
      version: health.version ?? null,
    };
  } catch (error) {
    return {
      siteId: site.id,
      siteName: site.name,
      host: site.routerHost,
      status: "offline",
      lastSeenAt: site.routerLastSeenAt?.toISOString() ?? null,
      error: error instanceof Error ? error.message : "Unreachable",
    };
  }
}

export async function getNetworkOverview(ownerId: string): Promise<NetworkOverview> {
  const sites = await prisma.site.findMany({
    where: { ownerId, status: { not: "ARCHIVED" } },
    select: {
      id: true,
      name: true,
      routerHost: true,
      routerPort: true,
      routerUsername: true,
      routerPassword: true,
      routerLastSeenAt: true,
    },
  });

  const siteNameById = new Map(sites.map((s) => [s.id, s.name]));
  const sessionsNested = await Promise.all(
    sites.map(async (site) => {
      const users = await getActiveUsersForSite(site.id);
      return users.map((u) => ({
        siteId: site.id,
        siteName: site.name,
        username: u.username,
        mac: u.mac,
        ip: u.framedIp,
        sessionTimeSec: u.sessionTime,
        bytesIn: u.inputOctets?.toString() ?? null,
        bytesOut: u.outputOctets?.toString() ?? null,
        startedAt: u.startedAt,
      }));
    }),
  );
  const sessions = sessionsNested.flat();

  let bytesIn = BigInt(0);
  let bytesOut = BigInt(0);
  for (const s of sessions) {
    if (s.bytesIn) bytesIn += BigInt(s.bytesIn);
    if (s.bytesOut) bytesOut += BigInt(s.bytesOut);
  }

  const routers = await Promise.all(sites.map((s) => probeRouterHealth(s)));

  const since = startOfToday();
  const txRows = await prisma.transaction.findMany({
    where: {
      userId: ownerId,
      status: { in: ["SUCCESS", "COMPLETED"] },
      OR: [
        { paidAt: { gte: since } },
        { AND: [{ paidAt: null }, { createdAt: { gte: since } }] },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 40,
    select: {
      id: true,
      siteId: true,
      amount: true,
      currency: true,
      provider: true,
      status: true,
      paidAt: true,
      createdAt: true,
    },
  });

  const collectionsTodayTzs = txRows.reduce((sum, t) => sum + t.amount, 0);

  return {
    totals: {
      activeSessions: sessions.length,
      bytesIn: bytesIn.toString(),
      bytesOut: bytesOut.toString(),
      collectionsTodayTzs,
      routersOnline: routers.filter((r) => r.status === "online").length,
      routersTotal: routers.length,
    },
    sessions,
    routers,
    collections: txRows.map((t) => ({
      id: t.id,
      siteId: t.siteId,
      siteName: siteNameById.get(t.siteId) ?? "Site",
      amount: t.amount,
      currency: t.currency,
      provider: t.provider,
      status: t.status,
      paidAt: t.paidAt?.toISOString() ?? null,
      createdAt: t.createdAt.toISOString(),
    })),
  };
}
