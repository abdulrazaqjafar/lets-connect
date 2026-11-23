"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Smartphone, Ticket } from "lucide-react";
import { toast } from "sonner";
import { BrandLogo } from "@/components/brand/logo";
import {
  AutoLoginForm,
  type MikroTikLoginPayload,
} from "@/components/portal/auto-login-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
type PortalPackage = {
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

type PortalSite = {
  id: string;
  name: string;
  location?: string | null;
};

type TabId = "lipa" | "voucher";

type SitePortalProps = {
  siteId: string;
  queryString: string;
};

export function SitePortal({ siteId, queryString }: SitePortalProps) {
  const params = useMemo(() => new URLSearchParams(queryString), [queryString]);
  const mac = params.get("mac") ?? "";
  const ip = params.get("ip") ?? "";
  const linkLoginOnly = params.get("link-login-only") ?? "";
  const userData = params.get("user-data") ?? "";

  const [tab, setTab] = useState<TabId>("lipa");
  const [site, setSite] = useState<PortalSite | null>(null);
  const [packages, setPackages] = useState<PortalPackage[]>([]);
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [provider, setProvider] = useState<"MPESA" | "TIGO_PESA" | "AIRTEL_MONEY">(
    "MPESA",
  );
  const [voucherCode, setVoucherCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [waitingPayment, setWaitingPayment] = useState(false);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [login, setLogin] = useState<MikroTikLoginPayload | null>(null);
  const [autoLoginUrl, setAutoLoginUrl] = useState<string | null>(null);
  const redirected = useRef(false);

  const loadPackages = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/portal/${siteId}/packages`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Failed to load packages");
      setSite(payload.site);
      setPackages(payload.packages ?? []);
      if (payload.packages?.[0]?.id) {
        setSelectedPackageId(payload.packages[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load packages");
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  useEffect(() => {
    void loadPackages();
  }, [loadPackages]);

  useEffect(() => {
    if (!paymentId || !waitingPayment) return;
    let cancelled = false;
    let attempts = 0;

    const poll = async () => {
      attempts += 1;
      try {
        const response = await fetch(`/api/portal/payments/${paymentId}/status`);
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Status check failed");

        if (payload.status === "FAILED") {
          if (!cancelled) {
            setWaitingPayment(false);
            setError(payload.failureReason ?? "Malipo yameshindikana. Jaribu tena.");
          }
          return;
        }

        if (payload.readyForLogin && payload.login) {
          if (!cancelled) {
            setWaitingPayment(false);
            setAutoLoginUrl(payload.autoLoginUrl ?? payload.login.autoLoginUrl);
            setLogin({
              username: payload.login.username,
              password: payload.login.password,
              linkLoginOnly: payload.login.linkLoginOnly || linkLoginOnly,
              linkOrig: payload.login.linkOrig,
            });
          }
          return;
        }
      } catch (err) {
        if (!cancelled && attempts > 40) {
          setWaitingPayment(false);
          setError(err instanceof Error ? err.message : "Payment timed out");
          return;
        }
      }

      if (!cancelled && attempts <= 40) {
        window.setTimeout(poll, 2000);
      } else if (!cancelled) {
        setWaitingPayment(false);
        setError("Muda wa malipo umeisha. Kama umelipwa, wasiliana na msaada.");
      }
    };

    void poll();
    return () => {
      cancelled = true;
    };
  }, [paymentId, waitingPayment, linkLoginOnly]);

  useEffect(() => {
    if (!autoLoginUrl || redirected.current) return;
    // Prefer GET redirect when provider returned login URL; form POST still runs via AutoLoginForm
    if (!linkLoginOnly && autoLoginUrl) {
      redirected.current = true;
      window.setTimeout(() => {
        window.location.href = autoLoginUrl;
      }, 800);
    }
  }, [autoLoginUrl, linkLoginOnly]);

  async function submitMobileMoney() {
    setError(null);
    if (!selectedPackageId) {
      setError("Select a package first");
      return;
    }
    if (!mac || !linkLoginOnly) {
      setError("Open this page from the Wi‑Fi hotspot (mac / link-login-only).");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`/api/portal/${siteId}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packageId: selectedPackageId,
          mac,
          ip,
          linkLoginOnly,
          userData,
          phone,
          provider,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Payment failed");

      toast.success(payload.message ?? "Check your phone");
      setPaymentId(payload.paymentId);
      setWaitingPayment(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitVoucher() {
    setError(null);
    setSubmitting(true);
    try {
      const response = await fetch(`/api/portal/${siteId}/voucher`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: voucherCode,
          mac,
          ip,
          linkLoginOnly,
          userData,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Invalid voucher");

      setAutoLoginUrl(payload.autoLoginUrl);
      setLogin({
        username: payload.loginUsername,
        password: payload.loginPassword,
        linkLoginOnly: payload.linkLoginOnly || linkLoginOnly || payload.autoLoginUrl,
      });
      toast.success("Voucher accepted — connecting…");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Voucher failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative min-h-dvh overflow-hidden bg-[#071018] px-4 py-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(45,212,191,0.25), transparent 55%), radial-gradient(ellipse 60% 40% at 100% 100%, rgba(14,116,144,0.2), transparent 50%), #071018",
        }}
      />
      <div className="relative mx-auto flex w-full max-w-md flex-col gap-5">
        <header className="space-y-4 rounded-3xl border border-white/10 bg-white/95 p-5 shadow-[0_30px_60px_-35px_rgba(0,0,0,0.7)] backdrop-blur">
          <BrandLogo />
          <div>
            <h1 className="font-heading text-2xl font-semibold tracking-tight text-slate-900">
              {site?.name ?? "Wi‑Fi Portal"}
            </h1>
            {site?.location ? (
              <p className="mt-0.5 text-sm text-slate-600">{site.location}</p>
            ) : (
              <p className="mt-0.5 text-sm text-slate-600">
                Choose a package or enter a voucher
              </p>
            )}
          </div>
        </header>

        {(mac || ip) && (
          <div className="flex flex-wrap gap-2 text-[11px] text-slate-300">
            {mac ? (
              <span className="rounded-full bg-white/8 px-2.5 py-1 ring-1 ring-white/15">
                MAC {mac}
              </span>
            ) : null}
            {ip ? (
              <span className="rounded-full bg-white/8 px-2.5 py-1 ring-1 ring-white/15">
                IP {ip}
              </span>
            ) : null}
          </div>
        )}

        {login ? (
          <div className="rounded-3xl border border-white/10 bg-white p-4 shadow-xl">
            <AutoLoginForm
              login={login}
              onSubmitted={() => {
                if (autoLoginUrl && !linkLoginOnly) {
                  window.location.href = autoLoginUrl;
                }
              }}
            />
          </div>
        ) : (
          <div className="space-y-4 rounded-3xl border border-white/10 bg-white p-4 shadow-xl">
            <div className="grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setTab("lipa")}
                className={`flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  tab === "lipa"
                    ? "bg-teal-700 text-white shadow-sm"
                    : "text-slate-600"
                }`}
              >
                <Smartphone className="size-4" />
                Mobile money
              </button>
              <button
                type="button"
                onClick={() => setTab("voucher")}
                className={`flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  tab === "voucher"
                    ? "bg-teal-700 text-white shadow-sm"
                    : "text-slate-600"
                }`}
              >
                <Ticket className="size-4" />
                Cash voucher
              </button>
            </div>

            {error ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                {error}
              </div>
            ) : null}

            {tab === "lipa" ? (
              <section className="space-y-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-slate-800">Packages</p>
                  {loading ? (
                    <div className="space-y-2">
                      {[0, 1, 2].map((i) => (
                        <div
                          key={i}
                          className="h-24 animate-pulse rounded-2xl bg-white/70 ring-1 ring-slate-200"
                        />
                      ))}
                    </div>
                  ) : packages.length === 0 ? (
                    <p className="rounded-2xl bg-white/80 px-4 py-6 text-center text-sm text-slate-600 ring-1 ring-slate-200">
                      No packages available.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {packages.map((pkg) => {
                        const selected = selectedPackageId === pkg.id;
                        return (
                          <button
                            key={pkg.id}
                            type="button"
                            onClick={() => setSelectedPackageId(pkg.id)}
                            className={`w-full rounded-2xl p-4 text-left transition ring-1 ${
                              selected
                                ? "bg-teal-50 ring-teal-500 shadow-sm"
                                : "bg-white/90 ring-slate-200 hover:ring-teal-300"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-semibold text-slate-900">
                                  {pkg.name}
                                </p>
                                <p className="mt-0.5 text-sm text-slate-600">
                                  {pkg.validityLabel}
                                  {pkg.dataLimitMb ? ` · ${pkg.dataLimitMb} MB` : ""}
                                </p>
                                <p className="mt-1 text-xs text-slate-500">
                                  ↓ {pkg.downloadLabel} · ↑ {pkg.uploadLabel}
                                </p>
                              </div>
                              <div className="rounded-xl bg-teal-700 px-3 py-2 text-white">
                                <p className="text-lg font-semibold leading-none">
                                  {pkg.priceAmount.toLocaleString()}
                                </p>
                                <p className="mt-1 text-[10px] uppercase opacity-90">
                                  {pkg.priceCurrency}
                                </p>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      ["MPESA", "M-Pesa"],
                      ["TIGO_PESA", "Tigo"],
                      ["AIRTEL_MONEY", "Airtel"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setProvider(value)}
                      className={`rounded-xl border px-2 py-2.5 text-xs font-medium ${
                        provider === value
                          ? "border-teal-600 bg-teal-50 text-teal-950"
                          : "border-slate-200 bg-white text-slate-600"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="phone">Phone number</Label>
                  <Input
                    id="phone"
                    inputMode="tel"
                    placeholder="07XXXXXXXX"
                    value={phone}
                    disabled={submitting || waitingPayment}
                    onChange={(e) => setPhone(e.target.value)}
                    className="h-11 bg-white text-base"
                  />
                </div>

                {waitingPayment ? (
                  <div className="flex items-center gap-2 rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-950">
                    <Loader2 className="size-4 animate-spin" />
                    Waiting for payment confirmation…
                  </div>
                ) : null}

                <Button
                  className="h-11 w-full bg-teal-700 text-white hover:bg-teal-800"
                  disabled={submitting || waitingPayment || !phone.trim()}
                  onClick={() => void submitMobileMoney()}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Sending…
                    </>
                  ) : (
                    "Pay now"
                  )}
                </Button>
              </section>
            ) : (
              <section className="space-y-4">
                <div className="rounded-2xl bg-white/90 p-4 ring-1 ring-slate-200">
                  <p className="text-sm font-medium text-slate-900">
                    Ingiza Cash Voucher
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    Enter the code printed on your voucher.
                  </p>
                  <div className="mt-4 grid gap-1.5">
                    <Label htmlFor="voucher">Voucher code</Label>
                    <Input
                      id="voucher"
                      placeholder="LCXXXXXXXX"
                      value={voucherCode}
                      disabled={submitting}
                      onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                      className="h-11 bg-white font-mono text-base tracking-wider"
                    />
                  </div>
                </div>

                <Button
                  className="h-11 w-full bg-teal-700 text-white hover:bg-teal-800"
                  disabled={submitting || voucherCode.trim().length < 4}
                  onClick={() => void submitVoucher()}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Verifying…
                    </>
                  ) : (
                    "Connect Wi‑Fi"
                  )}
                </Button>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
