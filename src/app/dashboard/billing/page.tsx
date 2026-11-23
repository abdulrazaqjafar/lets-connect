"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Crown } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { formatTzs } from "@/lib/money";
import { PLATFORM_PLANS } from "@/lib/plan-catalog";
import { cn } from "@/lib/utils";

type MePayload = {
  subscription: {
    status?: string;
    endsAt?: string | null;
    plan: { code: string; name: string; maxSites: number; priceAmount: number };
  } | null;
  quota: { usedSites: number; maxSites: number; remaining: number };
};

export default function BillingPage() {
  const [me, setMe] = useState<MePayload | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const response = await fetch("/api/auth/me");
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      toast.error(payload.error ?? "Please log in");
      return;
    }
    setMe(payload);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function choosePlan(planCode: string) {
    setBusy(planCode);
    try {
      const response = await fetch("/api/billing/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planCode }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error(payload.error ?? "Could not change plan");
        return;
      }
      toast.success(`${payload.subscription.plan.name} plan activated`);
      void load();
    } finally {
      setBusy(null);
    }
  }

  const currentCode = me?.subscription?.plan.code;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Billing"
        title="Subscriptions"
        description="Site capacity follows your plan. Upgrade when you add more locations."
      />

      {me ? (
        <div className="lc-panel rounded-2xl p-4 text-sm text-slate-600">
          Current plan:{" "}
          <span className="font-semibold text-slate-900">
            {me.subscription?.plan.name ?? "None"}
          </span>
          {" · "}
          Sites {me.quota.usedSites}/{me.quota.maxSites}
          {me.subscription?.endsAt
            ? ` · ends ${new Date(me.subscription.endsAt).toLocaleDateString()}`
            : null}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {PLATFORM_PLANS.map((plan) => {
          const active = currentCode === plan.code;
          return (
            <div
              key={plan.code}
              className={cn(
                "lc-panel relative flex flex-col rounded-2xl p-5",
                plan.highlighted && "ring-2 ring-teal-500/40",
              )}
            >
              {plan.highlighted ? (
                <span className="absolute -top-2.5 left-4 inline-flex items-center gap-1 rounded-full bg-teal-700 px-2.5 py-0.5 text-[10px] font-semibold text-white">
                  <Crown className="size-3" />
                  Popular
                </span>
              ) : null}
              <p className="font-heading text-lg font-semibold text-slate-900">{plan.name}</p>
              <p className="mt-1 text-sm text-slate-500">{plan.description}</p>
              <p className="mt-4 font-heading text-3xl font-semibold tracking-tight text-slate-950">
                {formatTzs(plan.priceAmount)}
                <span className="text-sm font-medium text-slate-500"> / month</span>
              </p>
              <p className="mt-1 text-xs font-medium text-teal-800">
                Up to {plan.maxSites} site{plan.maxSites === 1 ? "" : "s"}
              </p>
              <ul className="mt-4 space-y-2 text-sm text-slate-600">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-2">
                    <Check className="mt-0.5 size-3.5 shrink-0 text-teal-600" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Button
                className={cn(
                  "mt-5 w-full",
                  active
                    ? "bg-slate-900 text-white hover:bg-slate-800"
                    : "bg-teal-700 text-white hover:bg-teal-800",
                )}
                disabled={active || busy === plan.code}
                onClick={() => void choosePlan(plan.code)}
              >
                {active
                  ? "Current plan"
                  : busy === plan.code
                    ? "Activating…"
                    : "Choose"}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
