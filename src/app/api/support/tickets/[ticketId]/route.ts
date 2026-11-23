import { z } from "zod";
import { jsonError, jsonOk, handleRouteError } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { queueNotification } from "@/lib/notifications";
import { requireOwnerWithSubscription } from "@/lib/owner";
import { asRouteId } from "@/lib/params";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ ticketId?: string }> };

const replySchema = z.object({
  body: z.string().trim().min(1).max(5000),
  isInternal: z.boolean().optional(),
  status: z
    .enum(["OPEN", "IN_PROGRESS", "WAITING_CUSTOMER", "RESOLVED", "CLOSED"])
    .optional(),
});

export async function GET(_request: Request, context: RouteContext) {
  try {
    const param = asRouteId((await context.params).ticketId, "ticketId");
    if (!param.ok) return param.response;

    const owner = await requireOwnerWithSubscription();
    if (!owner.ok) return jsonError(owner.error, owner.status);

    const ticket = await prisma.supportTicket.findFirst({
      where: { id: param.id, ownerId: owner.ownerId },
      include: {
        site: { select: { id: true, name: true } },
        messages: {
          orderBy: { createdAt: "asc" },
          include: { author: { select: { id: true, name: true, email: true } } },
        },
      },
    });
    if (!ticket) return jsonError("Ticket not found", 404);

    return jsonOk({ ticket });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const param = asRouteId((await context.params).ticketId, "ticketId");
    if (!param.ok) return param.response;

    const owner = await requireOwnerWithSubscription();
    if (!owner.ok) return jsonError(owner.error, owner.status);
    const user = await getCurrentUser();

    const ticket = await prisma.supportTicket.findFirst({
      where: { id: param.id, ownerId: owner.ownerId },
    });
    if (!ticket) return jsonError("Ticket not found", 404);

    const values = replySchema.parse(await request.json());

    const updated = await prisma.$transaction(async (tx) => {
      await tx.ticketMessage.create({
        data: {
          ticketId: ticket.id,
          authorId: user?.id ?? null,
          body: values.body,
          isInternal: values.isInternal ?? false,
        },
      });

      return tx.supportTicket.update({
        where: { id: ticket.id },
        data: {
          status: values.status ?? ticket.status,
          resolvedAt:
            values.status === "RESOLVED" || values.status === "CLOSED"
              ? new Date()
              : ticket.resolvedAt,
        },
        include: {
          site: { select: { id: true, name: true } },
          messages: {
            orderBy: { createdAt: "asc" },
            include: {
              author: { select: { id: true, name: true, email: true } },
            },
          },
        },
      });
    });

    if (!values.isInternal && ticket.customerPhone) {
      await queueNotification({
        userId: owner.ownerId,
        channel: "SMS",
        template: "ticket.reply",
        recipient: ticket.customerPhone,
        body: `Update on "${ticket.subject}": ${values.body.slice(0, 140)}`,
        metadata: { ticketId: ticket.id },
      });
    }
    if (!values.isInternal && ticket.customerEmail) {
      await queueNotification({
        userId: owner.ownerId,
        channel: "EMAIL",
        template: "ticket.reply",
        recipient: ticket.customerEmail,
        subject: `Re: ${ticket.subject}`,
        body: values.body,
        metadata: { ticketId: ticket.id },
      });
    }

    return jsonOk({ ticket: updated });
  } catch (error) {
    return handleRouteError(error);
  }
}
