import { z } from "zod";
import { jsonCreated, jsonError, jsonOk, handleRouteError } from "@/lib/api";
import { hashPassword } from "@/lib/auth";
import { requireBillingOwner, requireOwnerWithSubscription } from "@/lib/owner";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(160),
  phone: z.string().trim().min(9).max(20).optional(),
  password: z.string().min(8).max(72),
  siteIds: z.array(z.string().min(1)).min(1),
});

/** GET /api/staff — list cashiers for the owner */
export async function GET() {
  try {
    const owner = await requireBillingOwner();
    if (!owner.ok) return jsonError(owner.error, owner.status);

    const cashiers = await prisma.user.findMany({
      where: { ownerId: owner.ownerId, role: "CASHIER" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        isActive: true,
        createdAt: true,
        cashierSites: {
          select: {
            siteId: true,
            site: { select: { id: true, name: true } },
          },
        },
      },
    });

    return jsonOk({
      staff: cashiers.map((c) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        isActive: c.isActive,
        createdAt: c.createdAt,
        sites: c.cashierSites.map((cs) => cs.site),
      })),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

/** POST /api/staff — create cashier + assign sites */
export async function POST(request: Request) {
  try {
    const owner = await requireOwnerWithSubscription();
    if (!owner.ok) return jsonError(owner.error, owner.status);

    const values = createSchema.parse(await request.json());
    const email = values.email.toLowerCase();

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return jsonError("Email already registered", 409);
    }

    const ownedSites = await prisma.site.findMany({
      where: { id: { in: values.siteIds }, ownerId: owner.ownerId },
      select: { id: true },
    });
    if (ownedSites.length !== values.siteIds.length) {
      return jsonError("One or more sites are invalid", 400);
    }

    const passwordHash = await hashPassword(values.password);
    const cashier = await prisma.user.create({
      data: {
        email,
        name: values.name,
        phone: values.phone?.trim() || null,
        passwordHash,
        role: "CASHIER",
        ownerId: owner.ownerId,
        cashierSites: {
          create: ownedSites.map((s) => ({ siteId: s.id })),
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        cashierSites: {
          select: { site: { select: { id: true, name: true } } },
        },
      },
    });

    return jsonCreated({
      staff: {
        id: cashier.id,
        name: cashier.name,
        email: cashier.email,
        phone: cashier.phone,
        sites: cashier.cashierSites.map((cs) => cs.site),
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
