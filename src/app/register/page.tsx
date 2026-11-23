"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { AuthCard } from "@/components/auth/auth-card";
import { OtpStep } from "@/components/auth/otp-step";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { registerFormSchema, type RegisterFormValues } from "@/lib/auth-form";
import { PLATFORM_PLANS } from "@/lib/plan-catalog";
import { formatTzs } from "@/lib/money";

type OtpPending = {
  challengeId: string;
  destinationMasked: string;
  channel: string;
  demo?: boolean;
  debugOtp?: string;
  message?: string;
};

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const planFromQuery = searchParams.get("plan")?.toLowerCase();
  const defaultPlan =
    PLATFORM_PLANS.find((p) => p.code === planFromQuery)?.code ?? "ngorongoro";

  const [otp, setOtp] = useState<OtpPending | null>(null);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      password: "",
      planCode: defaultPlan,
    },
  });

  async function onSubmit(values: RegisterFormValues) {
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      toast.error(payload.error ?? "Registration failed");
      return;
    }
    if (payload.requiresOtp && payload.challengeId) {
      setOtp({
        challengeId: payload.challengeId,
        destinationMasked: payload.destinationMasked ?? "***",
        channel: payload.channel ?? "EMAIL",
        demo: payload.demo,
        debugOtp: payload.debugOtp,
        message: payload.message,
      });
      setCode(payload.debugOtp ?? "");
      toast.success(payload.message ?? "OTP sent");
      return;
    }
    toast.success(
      `Account created · ${payload.subscription?.plan?.name ?? "Trial"}`,
    );
    router.push("/dashboard");
    router.refresh();
  }

  async function onVerify() {
    if (!otp) return;
    setVerifying(true);
    try {
      const response = await fetch("/api/auth/register/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId: otp.challengeId, code }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error(payload.error ?? "Verification failed");
        return;
      }
      toast.success(
        `Account created · ${payload.subscription?.plan?.name ?? "Trial"}`,
      );
      router.push("/dashboard");
      router.refresh();
    } finally {
      setVerifying(false);
    }
  }

  return (
    <AuthCard
      title={otp ? "Verify email" : "Sign up"}
      subtitle={
        otp
          ? "Enter the OTP sent to your email to create your account."
          : "Create an operator account and choose a site subscription."
      }
      footer={
        otp ? null : (
          <>
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-medium text-[#00338D] hover:underline"
            >
              Log in
            </Link>
          </>
        )
      }
    >
      {otp ? (
        <OtpStep
          destinationMasked={otp.destinationMasked}
          channel={otp.channel}
          demo={otp.demo}
          debugOtp={otp.debugOtp}
          code={code}
          onCodeChange={setCode}
          onVerify={onVerify}
          onBack={() => {
            setOtp(null);
            setCode("");
          }}
          submitting={verifying}
          message={otp.message}
        />
      ) : (
        <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="grid gap-1.5">
            <Label htmlFor="name">Full name</Label>
            <Input id="name" {...form.register("name")} />
            {form.formState.errors.name ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.name.message}
              </p>
            ) : null}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              {...form.register("email")}
            />
            {form.formState.errors.email ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.email.message}
              </p>
            ) : null}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="phone">Phone (optional)</Label>
            <Input
              id="phone"
              {...form.register("phone")}
              placeholder="07XXXXXXXX"
              autoComplete="tel"
            />
            {form.formState.errors.phone ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.phone.message}
              </p>
            ) : null}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              {...form.register("password")}
            />
            {form.formState.errors.password ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.password.message}
              </p>
            ) : null}
          </div>
          <div className="grid gap-1.5">
            <Label>Subscription plan</Label>
            <Select
              value={form.watch("planCode")}
              onValueChange={(value) => {
                if (value)
                  form.setValue(
                    "planCode",
                    value as RegisterFormValues["planCode"],
                  );
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a plan" />
              </SelectTrigger>
              <SelectContent>
                {PLATFORM_PLANS.map((plan) => (
                  <SelectItem key={plan.code} value={plan.code}>
                    {plan.name} · {formatTzs(plan.priceAmount)}/mo ·{" "}
                    {plan.maxSites} site
                    {plan.maxSites === 1 ? "" : "s"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            type="submit"
            className="h-10 bg-[#00338D] text-white hover:bg-[#00266b]"
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting
              ? "Sending OTP…"
              : "Send OTP · Start trial"}
          </Button>
        </form>
      )}
    </AuthCard>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <p className="p-8 text-center text-sm text-slate-400">Loading…</p>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}
