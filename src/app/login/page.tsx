"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { AuthCard } from "@/components/auth/auth-card";
import { OtpStep } from "@/components/auth/otp-step";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginFormSchema, type LoginFormValues } from "@/lib/auth-form";

type OtpPending = {
  challengeId: string;
  destinationMasked: string;
  channel: string;
  demo?: boolean;
  debugOtp?: string;
  message?: string;
};

export default function LoginPage() {
  const router = useRouter();
  const [otp, setOtp] = useState<OtpPending | null>(null);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginFormValues) {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      toast.error(payload.error ?? "Login failed");
      return;
    }
    if (payload.requiresOtp && payload.challengeId) {
      setOtp({
        challengeId: payload.challengeId,
        destinationMasked: payload.destinationMasked ?? "***",
        channel: payload.channel ?? "SMS",
        demo: payload.demo,
        debugOtp: payload.debugOtp,
        message: payload.message,
      });
      setCode(payload.debugOtp ?? "");
      toast.success(payload.message ?? "OTP sent");
      return;
    }
    toast.success("Welcome back");
    router.push(
      typeof payload.redirectTo === "string" ? payload.redirectTo : "/dashboard",
    );
    router.refresh();
  }

  async function onVerify() {
    if (!otp) return;
    setVerifying(true);
    try {
      const response = await fetch("/api/auth/login/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId: otp.challengeId, code }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error(payload.error ?? "Verification failed");
        return;
      }
      toast.success("Welcome back");
      router.push(
        typeof payload.redirectTo === "string"
          ? payload.redirectTo
          : "/dashboard",
      );
      router.refresh();
    } finally {
      setVerifying(false);
    }
  }

  return (
    <AuthCard
      title={otp ? "Verify login" : "Log in"}
      subtitle={
        otp
          ? "Enter the one-time code to finish signing in."
          : "Sign in to manage your sites and equipment."
      }
      footer={
        otp ? null : (
          <>
            No account?{" "}
            <Link
              href="/register"
              className="font-medium text-[#00338D] hover:underline"
            >
              Sign up
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
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              {...form.register("password")}
            />
            {form.formState.errors.password ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.password.message}
              </p>
            ) : null}
          </div>
          <Button
            type="submit"
            className="h-10 bg-[#00338D] text-white hover:bg-[#00266b]"
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting ? "Checking…" : "Continue"}
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
