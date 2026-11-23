import { prisma } from "@/lib/prisma";

/**
 * Upsert FreeRADIUS `nas` client row for a Lets Connect site / MikroTik router.
 */
export async function syncSiteToNasTable(site: {
  name: string;
  nasIdentifier: string;
  radiusSecret: string;
  routerHost?: string | null;
}): Promise<void> {
  const nasname = site.routerHost?.trim() || site.nasIdentifier;

  const existing = await prisma.nas.findFirst({
    where: {
      OR: [{ nasname }, { shortname: site.nasIdentifier }],
    },
  });

  const data = {
    nasname,
    shortname: site.nasIdentifier.slice(0, 32),
    type: "mikrotik",
    secret: site.radiusSecret,
    description: site.name.slice(0, 200),
  };

  if (existing) {
    await prisma.nas.update({
      where: { id: existing.id },
      data,
    });
  } else {
    await prisma.nas.create({ data });
  }
}
