import { z } from "zod";
import { jsonCreated, jsonError, jsonOk, handleRouteError } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { queueNotification } from "@/lib/notifications";
import { requireOwnerWithSubscription } from "@/lib/owner";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  subject: z.string().trim().min(3).max(200),
  body: z.string().trim().min(3).max(5000),
  siteId: z.string().cuid().optional().nullable(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
  customerName: z.string().trim().max(120).optional().nullable(),
  customerPhone: z.string().trim().max(32).optional().nullable(),
  customerEmail: z.string().trim().email().optional().nullable(),
});

export async function GET() {
  try {
    const owner = await requireOwnerWithSubscription();
    if (!owner.ok) return jsonError(owner.error, owner.status);

    const tickets = await prisma.supportTicket.findMany({
      where: { ownerId: owner.ownerId },
      orderBy: { updatedAt: "desc" },
      include: {
        site: { select: { id: true, name: true } },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { body: true, createdAt: true },
        },
        _count: { select: { messages: true } },
      },
    });

    return jsonOk({ tickets });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const owner = await requireOwnerWithSubscription();
    if (!owner.ok) return jsonError(owner.error, owner.status);
    const user = await getCurrentUser();

    const values = createSchema.parse(await request.json());

    if (values.siteId) {
      const site = await prisma.site.findFirst({
        where: { id: values.siteId, ownerId: owner.ownerId },
        select: { id: true },
      });
      if (!site) return jsonError("Site not found", 404);
    }

    const ticket = await prisma.supportTicket.create({
      data: {
        ownerId: owner.ownerId,
        siteId: values.siteId ?? null,
        subject: values.subject,
        priority: values.priority ?? "NORMAL",
        customerName: values.customerName ?? null,
        customerPhone: values.customerPhone ?? null,
        customerEmail: values.customerEmail ?? null,
        messages: {
          create: {
            authorId: user?.id ?? null,
            body: values.body,
            isInternal: false,
          },
        },
      },
      include: {
        site: { select: { id: true, name: true } },
        messages: true,
      },
    });

    if (values.customerPhone) {
      await queueNotification({
        userId: owner.ownerId,
        channel: "SMS",
        template: "ticket.created",
        recipient: values.customerPhone,
        body: `Ticket opened: ${values.subject}. We will update you soon.`,
        metadata: { ticketId: ticket.id },
      });
    }
    if (values.customerEmail) {
      await queueNotification({
        userId: owner.ownerId,
        channel: "EMAIL",
        template: "ticket.created",
        recipient: values.customerEmail,
        subject: `Support ticket: ${values.subject}`,
        body: `We received your request:\n\n${values.body}\n\nTicket ID: ${ticket.id}`,
        metadata: { ticketId: ticket.id },
      });
    }

    return jsonCreated({ ticket });
  } catch (error) {
    return handleRouteError(error);
  }
}
