import { createHash, randomInt } from "crypto";
import type { NotificationChannel, OtpPurpose, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { queueNotification } from "@/lib/notifications";

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export function otpDemoMode() {
  if (process.env.OTP_DEMO_MODE === "true") return true;
  if (process.env.OTP_DEMO_MODE === "false") return false;
  return !process.env.SMS_API_KEY?.trim();
}

export function normalizeTzPhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("255") && digits.length >= 12) return digits.slice(0, 12);
  if (digits.startsWith("0") && digits.length >= 10) {
    return `255${digits.slice(1, 10)}`;
  }
  if (digits.length === 9) return `255${digits}`;
  return null;
}

function hashOtp(code: string) {
  const pepper =
    process.env.AUTH_SECRET?.trim() ||
    process.env.OTP_PEPPER?.trim() ||
    "lets-connect-otp";
  return createHash("sha256").update(`${code}:${pepper}`).digest("hex");
}

function generateCode() {
  return String(randomInt(100000, 999999));
}

export type CreateOtpInput = {
  purpose: OtpPurpose;
  destination: string;
  channel?: NotificationChannel;
  userId?: string | null;
  payload?: Prisma.InputJsonValue;
};

export async function createAndSendOtp(input: CreateOtpInput) {
  const code = generateCode();
  const destination = input.destination.trim().toLowerCase();
  const channel = input.channel ?? "SMS";

  // Invalidate previous open challenges for same purpose+destination
  await prisma.otpChallenge.updateMany({
    where: {
      purpose: input.purpose,
      destination,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    data: { consumedAt: new Date() },
  });

  const challenge = await prisma.otpChallenge.create({
    data: {
      purpose: input.purpose,
      destination,
      channel,
      codeHash: hashOtp(code),
      userId: input.userId ?? null,
      payload: input.payload,
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    },
  });

  const body = `Lets Connect OTP: ${code}. Inatumika kwa dakika 10. Usishiriki na mtu yeyote.`;

  if (channel === "EMAIL") {
    await queueNotification({
      userId: input.userId,
      channel: "EMAIL",
      template: "auth.otp",
      recipient: destination,
      subject: "Lets Connect verification code",
      body,
      metadata: { challengeId: challenge.id },
    });
  } else {
    await queueNotification({
      userId: input.userId,
      channel: "SMS",
      template: "auth.otp",
      recipient: destination,
      body,
      metadata: { challengeId: challenge.id },
    });
  }

  return {
    challengeId: challenge.id,
    expiresAt: challenge.expiresAt.toISOString(),
    channel,
    destinationMasked: maskDestination(destination, channel),
    demo: otpDemoMode(),
    /** Only returned in demo so you can test without SMS provider */
    debugOtp: otpDemoMode() ? code : undefined,
  };
}

function maskDestination(dest: string, channel: NotificationChannel) {
  if (channel === "EMAIL") {
    const [u, d] = dest.split("@");
    if (!u || !d) return "***";
    return `${u.slice(0, 2)}***@${d}`;
  }
  if (dest.length < 6) return "***";
  return `${dest.slice(0, 5)}***${dest.slice(-2)}`;
}

export async function verifyOtp(opts: {
  challengeId: string;
  code: string;
  purpose: OtpPurpose;
}) {
  const challenge = await prisma.otpChallenge.findUnique({
    where: { id: opts.challengeId },
  });
  if (!challenge || challenge.purpose !== opts.purpose) {
    return { ok: false as const, error: "Invalid or expired code", status: 400 };
  }
  if (challenge.consumedAt) {
    return { ok: false as const, error: "Code already used", status: 400 };
  }
  if (challenge.expiresAt.getTime() < Date.now()) {
    return { ok: false as const, error: "Code expired — request a new one", status: 400 };
  }
  if (challenge.attempts >= MAX_ATTEMPTS) {
    return { ok: false as const, error: "Too many attempts — request a new code", status: 429 };
  }

  const match = challenge.codeHash === hashOtp(opts.code.trim());
  if (!match) {
    await prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { attempts: { increment: 1 } },
    });
    return { ok: false as const, error: "Incorrect code", status: 401 };
  }

  await prisma.otpChallenge.update({
    where: { id: challenge.id },
    data: { consumedAt: new Date() },
  });

  return { ok: true as const, challenge };
}
