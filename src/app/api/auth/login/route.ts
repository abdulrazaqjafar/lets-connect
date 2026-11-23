import { z } from "zod";
import { jsonError, jsonOk, handleRouteError } from "@/lib/api";
import { verifyPassword } from "@/lib/auth";
import { createAndSendOtp, normalizeTzPhone } from "@/lib/otp";
import { prisma } from "@/lib/prisma";

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

/**
 * Step 1 — check password, then send OTP (SMS to phone, else email).
 */
export async function POST(request: Request) {
  try {
    const values = loginSchema.parse(await request.json());
    const email = values.email.toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        phone: true,
        passwordHash: true,
        isActive: true,
      },
    });

    if (!user?.passwordHash || !user.isActive) {
      return jsonError("Invalid email or password", 401);
    }

    const valid = await verifyPassword(values.password, user.passwordHash);
    if (!valid) {
      return jsonError("Invalid email or password", 401);
    }

    const phone = user.phone ? normalizeTzPhone(user.phone) : null;
    const useSms = Boolean(phone);

    const otp = await createAndSendOtp({
      purpose: "LOGIN",
      destination: useSms ? phone! : user.email,
      channel: useSms ? "SMS" : "EMAIL",
      userId: user.id,
      payload: { userId: user.id },
    });

    return jsonOk({
      requiresOtp: true,
      challengeId: otp.challengeId,
      expiresAt: otp.expiresAt,
      destinationMasked: otp.destinationMasked,
      channel: otp.channel,
      demo: otp.demo,
      debugOtp: otp.debugOtp,
      message: useSms
        ? otp.demo
          ? "Demo OTP — use the code shown (add SMS keys for live)"
          : "OTP sent to your phone"
        : otp.demo
          ? "Demo OTP sent to email (logged) — use the code shown"
          : "OTP sent to your email",
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
