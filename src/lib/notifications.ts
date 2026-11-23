import type { NotificationChannel, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type QueueNotificationInput = {
  userId?: string | null;
  channel: NotificationChannel;
  template: string;
  recipient: string;
  subject?: string;
  body: string;
  metadata?: Prisma.InputJsonValue;
};

/**
 * Queue an SMS / email / in-app notification.
 * Delivery is best-effort: DEMO/local logs; production uses RESEND_API_KEY / SMS_API_KEY.
 */
export async function queueNotification(input: QueueNotificationInput) {
  const row = await prisma.notification.create({
    data: {
      userId: input.userId ?? null,
      channel: input.channel,
      template: input.template,
      recipient: input.recipient,
      subject: input.subject,
      body: input.body,
      metadata: input.metadata,
      status: "PENDING",
    },
  });

  try {
    await deliverNotification(row.id);
  } catch (error) {
    await prisma.notification.update({
      where: { id: row.id },
      data: {
        status: "FAILED",
        error: error instanceof Error ? error.message : "Delivery failed",
      },
    });
  }

  return row;
}

async function deliverNotification(id: string) {
  const note = await prisma.notification.findUnique({ where: { id } });
  if (!note) return;

  if (note.channel === "IN_APP") {
    await prisma.notification.update({
      where: { id },
      data: { status: "SENT", sentAt: new Date() },
    });
    return;
  }

  if (note.channel === "EMAIL") {
    const key = process.env.RESEND_API_KEY?.trim();
    if (!key) {
      console.info("[notify:email:demo]", note.recipient, note.subject, note.body);
      await prisma.notification.update({
        where: { id },
        data: { status: "SENT", sentAt: new Date(), error: "demo_logged" },
      });
      return;
    }
    const from = process.env.EMAIL_FROM?.trim() || "Lets Connect <noreply@tech-spherewifi.xyz>";
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [note.recipient],
        subject: note.subject ?? "Lets Connect",
        text: note.body,
      }),
    });
    if (!res.ok) {
      throw new Error(`Resend ${res.status}: ${await res.text()}`);
    }
    await prisma.notification.update({
      where: { id },
      data: { status: "SENT", sentAt: new Date() },
    });
    return;
  }

  // SMS — Africa's Talking / Beem style stub
  const smsKey = process.env.SMS_API_KEY?.trim();
  if (!smsKey) {
    console.info("[notify:sms:demo]", note.recipient, note.body);
    await prisma.notification.update({
      where: { id },
      data: { status: "SENT", sentAt: new Date(), error: "demo_logged" },
    });
    return;
  }

  const smsUrl = process.env.SMS_API_URL?.trim();
  if (!smsUrl) {
    throw new Error("SMS_API_URL is required when SMS_API_KEY is set");
  }
  const res = await fetch(smsUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${smsKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: note.recipient,
      message: note.body,
      from: process.env.SMS_SENDER_ID?.trim() || "LetsConnect",
    }),
  });
  if (!res.ok) {
    throw new Error(`SMS ${res.status}: ${await res.text()}`);
  }
  await prisma.notification.update({
    where: { id },
    data: { status: "SENT", sentAt: new Date() },
  });
}

export async function notifyPaymentSuccess(opts: {
  ownerId: string;
  phone?: string | null;
  email?: string | null;
  amount: number;
  currency: string;
  siteName: string;
}) {
  const body = `Payment of ${opts.amount} ${opts.currency} received for ${opts.siteName}. Thank you.`;
  if (opts.phone) {
    await queueNotification({
      userId: opts.ownerId,
      channel: "SMS",
      template: "payment.success",
      recipient: opts.phone,
      body,
    });
  }
  if (opts.email) {
    await queueNotification({
      userId: opts.ownerId,
      channel: "EMAIL",
      template: "payment.success",
      recipient: opts.email,
      subject: "Payment received — Lets Connect",
      body,
    });
  }
  await queueNotification({
    userId: opts.ownerId,
    channel: "IN_APP",
    template: "payment.success",
    recipient: opts.ownerId,
    subject: "Payment received",
    body,
  });
}
