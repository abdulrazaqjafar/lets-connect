"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { MikroTikLoginPayload } from "@/components/portal/auto-login-form";

export type PortalPackageOption = {
  id: string;
  name: string;
  description: string | null;
  priceAmount: number;
  priceCurrency: string;
  validityLabel: string;
  downloadLabel: string;
  uploadLabel: string;
  dataLimitMb: number | null;
};

type PaymentModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  siteId: string;
  pkg: PortalPackageOption | null;
  mac: string;
  linkLoginOnly: string;
  clientIp?: string | null;
  chapId?: string | null;
  chapChallenge?: string | null;
  linkOrig?: string | null;
  onPaid: (login: MikroTikLoginPayload) => void;
};

type Provider = "MPESA" | "TIGO_PESA";

export function PaymentModal({
  open,
  onOpenChange,
  siteId,
  pkg,
  mac,
  linkLoginOnly,
  clientIp,
  chapId,
  chapChallenge,
  linkOrig,
  onPaid,
}: PaymentModalProps) {
  const [provider, setProvider] = useState<Provider>("MPESA");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setSubmitting(false);
      setWaiting(false);
      setError(null);
      setHint(null);
      setPaymentId(null);
      setPhone("");
      setProvider("MPESA");
    }
  }, [open]);

  useEffect(() => {
    if (!paymentId || !waiting) return;

    let cancelled = false;
    let attempts = 0;

    const poll = async () => {
      attempts += 1;
      try {
        const response = await fetch(`/api/portal/payments/${paymentId}/status`);
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error ?? "Could not check payment status");
        }

        if (payload.status === "FAILED") {
          if (!cancelled) {
            setWaiting(false);
            setError(payload.failureReason ?? "Payment failed. Try again.");
          }
          return;
        }

        if (payload.readyForLogin && payload.login) {
          if (!cancelled) {
            setWaiting(false);
            onPaid({
              username: payload.login.username,
              password: payload.login.password,
              linkLoginOnly: payload.login.linkLoginOnly,
              chapId: payload.login.chapId,
              chapChallenge: payload.login.chapChallenge,
              linkOrig: payload.login.linkOrig,
            });
            onOpenChange(false);
          }
          return;
        }
      } catch (err) {
        if (!cancelled && attempts > 40) {
          setWaiting(false);
          setError(err instanceof Error ? err.message : "Payment timed out");
          return;
        }
      }

      if (!cancelled && attempts <= 40) {
        window.setTimeout(poll, 2000);
      } else if (!cancelled) {
        setWaiting(false);
        setError("Payment timed out. If you were charged, reconnect and contact support.");
      }
    };

    void poll();
    return () => {
      cancelled = true;
    };
  }, [paymentId, waiting, onPaid, onOpenChange]);

  async function handlePay() {
    if (!pkg) return;
    setError(null);
    setSubmitting(true);

    try {
      const response = await fetch("/api/portal/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteId,
          packageId: pkg.id,
          mac,
          linkLoginOnly,
          clientIp,
          chapId,
          chapChallenge,
          linkOrig,
          phone,
          provider,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not start payment");
      }

      setPaymentId(payload.paymentId);
      setHint(payload.message);
      setWaiting(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-1.5rem)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pay with mobile money</DialogTitle>
          <DialogDescription>
            {pkg
              ? `${pkg.name} · ${pkg.priceAmount} ${pkg.priceCurrency}`
              : "Select a package"}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setProvider("MPESA")}
              className={`rounded-xl border px-3 py-3 text-sm font-medium transition ${
                provider === "MPESA"
                  ? "border-teal-600 bg-teal-50 text-teal-950"
                  : "border-border bg-background text-muted-foreground"
              }`}
            >
              M-Pesa
            </button>
            <button
              type="button"
              onClick={() => setProvider("TIGO_PESA")}
              className={`rounded-xl border px-3 py-3 text-sm font-medium transition ${
                provider === "TIGO_PESA"
                  ? "border-teal-600 bg-teal-50 text-teal-950"
                  : "border-border bg-background text-muted-foreground"
              }`}
            >
              Tigo Pesa
            </button>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="mm-phone">
              {provider === "TIGO_PESA" ? "Tigo Pesa number" : "M-Pesa number"}
            </Label>
            <Input
              id="mm-phone"
              inputMode="tel"
              autoComplete="tel"
              placeholder="07XXXXXXXX"
              value={phone}
              disabled={waiting || submitting}
              onChange={(event) => setPhone(event.target.value)}
              className="h-11 text-base"
            />
          </div>

          {hint ? (
            <p className="rounded-xl bg-muted px-3 py-2 text-sm text-muted-foreground">
              {hint}
            </p>
          ) : null}

          {waiting ? (
            <div className="flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-3 py-3 text-sm text-teal-950">
              <Loader2 className="size-4 animate-spin" />
              Waiting for payment confirmation…
            </div>
          ) : null}

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void handlePay()}
            disabled={!pkg || !phone.trim() || submitting || waiting}
            className="bg-teal-700 text-white hover:bg-teal-800"
          >
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Sending…
              </>
            ) : (
              `Pay ${pkg?.priceAmount ?? ""} ${pkg?.priceCurrency ?? ""}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
