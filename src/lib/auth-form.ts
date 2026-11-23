import { z } from "zod";
import { PLATFORM_PLANS } from "@/lib/plan-catalog";

export const loginFormSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export const registerFormSchema = z.object({
  name: z.string().trim().min(2, "Name is required"),
  email: z.string().trim().email("Enter a valid email"),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  password: z.string().min(8, "Password must be at least 8 characters"),
  planCode: z
    .string()
    .refine(
      (value) => PLATFORM_PLANS.some((plan) => plan.code === value),
      "Select a valid plan",
    ),
});

export type LoginFormValues = z.infer<typeof loginFormSchema>;
export type RegisterFormValues = z.infer<typeof registerFormSchema>;
