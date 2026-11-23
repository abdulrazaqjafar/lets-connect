"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Crown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatTzs } from "@/lib/money";
import { PLATFORM_PLANS } from "@/lib/plan-catalog";
import { cn } from "@/lib/utils";

type MePayload = {
  locked?: boolean;
  lockReason?: string | null;
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
  const [phone, setPhone] = useState("");
  const [payingPlan, setPayingPlan] = useState<string | null>(null);

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

  async function payPlan(planCode: string) {
    if (!phone.trim()) {
      toast.error("Enter the mobile money number that will pay");
      return;
    }
    setPayingPlan(planCode);
    setBusy(planCode);
    try {
      const response = await fetch("/api/billing/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planCode, phone: phone.trim() }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error(payload.error ?? "Payment could not start");
        return;
      }
      toast.success(payload.message ?? "Check your phone");
      const paymentId = payload.paymentId as string;
      // Poll until SUCCESS or timeout
      for (let i = 0; i < 40; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const st = await fetch(`/api/billing/payments/${paymentId}/status`);
        const body = await st.json().catch(() => ({}));
        if (body.status === "SUCCESS" || body.status === "COMPLETED") {
          toast.success("Subscription activated");
          void load();
          return;
        }
        if (body.status === "FAILED") {
          toast.error("Payment failed");
          return;
        }
      }
      toast.message("Still waiting for payment confirmation…");
      void load();
    } finally {
      setBusy(null);
      setPayingPlan(null);
    }
  }

  const currentCode = me?.subscription?.plan.code;
  const endsAt = me?.subscription?.endsAt
    ? new Date(me.subscription.endsAt)
    : null;
  const daysLeft =
    endsAt && endsAt > new Date()
      ? Math.ceil((endsAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
      : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Billing"
        title="Subscriptions"
        description="Pay with Tanzania mobile money (Snippe). After trial ends, sites and Wi‑Fi portal pause until you renew."
      />

      {me?.locked ? (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-semibold">Account locked</p>
          <p className="mt-1">
            {me.lockReason ??
              "Renew a plan below to restore sites, vouchers, and the Wi‑Fi portal."}
          </p>
        </div>
      ) : null}

      {me ? (
        <div className="lc-panel space-y-1 rounded-2xl p-4 text-sm text-slate-600">
          <p>
            Current plan:{" "}
            <span className="font-semibold text-slate-900">
              {me.subscription?.plan.name ?? "None"}
            </span>
            {me.subscription?.status ? ` (${me.subscription.status})` : null}
          </p>
          <p>
            Sites {me.quota.usedSites}/{me.quota.maxSites}
            {endsAt
              ? ` · ${me.locked ? "ended" : "ends"} ${endsAt.toLocaleDateString()}${
                  !me.locked && daysLeft > 0 ? ` (${daysLeft}d left)` : ""
                }`
              : null}
          </p>
        </div>
      ) : null}

      <div className="lc-panel max-w-md space-y-2 rounded-2xl p-4">
        <Label htmlFor="payPhone">Mobile money number (payer)</Label>
        <Input
          id="payPhone"
          className="bg-white"
          placeholder="07XXXXXXXX"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <p className="text-xs text-slate-500">
          M-Pesa, Airtel Money, Mixx by Yas, or Halotel via Snippe.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {PLATFORM_PLANS.map((plan) => {
          const active = currentCode === plan.code && !me?.locked;
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
              <p className="font-heading text-lg font-semibold text-slate-900">
                {plan.name}
              </p>
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
                className="mt-5 w-full bg-teal-700 text-white hover:bg-teal-800"
                disabled={busy === plan.code}
                onClick={() => void payPlan(plan.code)}
              >
                {busy === plan.code ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Waiting…
                  </>
                ) : active ? (
                  "Renew / extend"
                ) : payingPlan === plan.code ? (
                  "Paying…"
                ) : (
                  "Pay with mobile money"
                )}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
