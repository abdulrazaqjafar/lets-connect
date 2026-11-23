"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { AuthCard } from "@/components/auth/auth-card";
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

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const planFromQuery = searchParams.get("plan")?.toLowerCase();
  const defaultPlan =
    PLATFORM_PLANS.find((p) => p.code === planFromQuery)?.code ?? "ngorongoro";

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
    toast.success(
      `Account created · ${payload.subscription?.plan?.name ?? "Trial"}`,
    );
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <AuthCard
      title="Sign up"
      subtitle="Create an operator account and choose a site subscription."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-teal-700 hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)}>
        <div className="grid gap-1.5">
          <Label htmlFor="name">Full name</Label>
          <Input id="name" {...form.register("name")} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" {...form.register("email")} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="phone">Phone (optional)</Label>
          <Input id="phone" {...form.register("phone")} placeholder="07XXXXXXXX" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            {...form.register("password")}
          />
        </div>
        <div className="grid gap-1.5">
          <Label>Subscription plan</Label>
          <Select
            value={form.watch("planCode")}
            onValueChange={(value) => {
              if (value) form.setValue("planCode", value as RegisterFormValues["planCode"]);
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a plan" />
            </SelectTrigger>
            <SelectContent>
              {PLATFORM_PLANS.map((plan) => (
                <SelectItem key={plan.code} value={plan.code}>
                  {plan.name} · {formatTzs(plan.priceAmount)}/mo · {plan.maxSites} site
                  {plan.maxSites === 1 ? "" : "s"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          type="submit"
          className="h-10 bg-teal-700 text-white hover:bg-teal-800"
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting ? "Creating…" : "Start 14-day trial"}
        </Button>
      </form>
    </AuthCard>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<p className="p-8 text-center text-sm text-slate-400">Loading…</p>}>
      <RegisterForm />
    </Suspense>
  );
}
