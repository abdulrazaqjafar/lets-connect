import { z } from "zod";
import { jsonError, jsonOk, handleRouteError } from "@/lib/api";
import { hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isPlatformPlanCode } from "@/lib/plan-catalog";
import { createAndSendOtp, normalizeTzPhone } from "@/lib/otp";

const registerStartSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(160),
  phone: z.string().trim().min(9).max(20),
  password: z.string().min(8).max(72),
  planCode: z.string().trim().default("ngorongoro"),
});

/**
 * Step 1 — validate details + send OTP to phone (account created only after verify).
 */
export async function POST(request: Request) {
  try {
    const values = registerStartSchema.parse(await request.json());
    const planCode = values.planCode.toLowerCase();

    if (!isPlatformPlanCode(planCode)) {
      return jsonError("Invalid subscription plan", 400);
    }

    const phone = normalizeTzPhone(values.phone);
    if (!phone) {
      return jsonError("Enter a valid Tanzania phone (07XXXXXXXX)", 400);
    }

    const email = values.email.toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return jsonError("Email already registered. Please log in instead.", 409);
    }

    const passwordHash = await hashPassword(values.password);

    const otp = await createAndSendOtp({
      purpose: "REGISTER",
      destination: phone,
      channel: "SMS",
      payload: {
        name: values.name,
        email,
        phone,
        passwordHash,
        planCode,
      },
    });

    return jsonOk({
      requiresOtp: true,
      challengeId: otp.challengeId,
      expiresAt: otp.expiresAt,
      destinationMasked: otp.destinationMasked,
      channel: otp.channel,
      demo: otp.demo,
      debugOtp: otp.debugOtp,
      message: otp.demo
        ? "Demo OTP (no SMS key) — use the code shown"
        : "OTP sent to your phone",
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
