"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Smartphone, Ticket, Wifi } from "lucide-react";
import { toast } from "sonner";
import { BrandLogo } from "@/components/brand/logo";
import {
  AutoLoginForm,
  type MikroTikLoginPayload,
} from "@/components/portal/auto-login-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatTzs } from "@/lib/money";
import { cn } from "@/lib/utils";

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
  brandName?: string | null;
  brandLogoUrl?: string | null;
  brandPrimaryColor?: string | null;
};

type TabId = "lipa" | "voucher";

type SitePortalProps = {
  siteId: string;
  queryString: string;
};

const MNO = [
  { value: "MPESA" as const, label: "M-Pesa" },
  { value: "TIGO_PESA" as const, label: "Mixx" },
  { value: "AIRTEL_MONEY" as const, label: "Airtel" },
];

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
            setError(payload.failureReason ?? "Payment failed. Please try again.");
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
        setError(
          "Payment timed out. If you were charged, ask the cashier or try again.",
        );
      }
    };

    void poll();
    return () => {
      cancelled = true;
    };
  }, [paymentId, waitingPayment, linkLoginOnly]);

  useEffect(() => {
    if (!autoLoginUrl || redirected.current) return;
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
      setError("Open this page from the Wi‑Fi network (hotspot redirect).");
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
      toast.success("Connected — starting session…");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Voucher failed");
    } finally {
      setSubmitting(false);
    }
  }

  const brandColor = site?.brandPrimaryColor || "#F78E1E";
  const displayName = site?.brandName || site?.name || "Wi‑Fi";
  const selectedPkg = packages.find((p) => p.id === selectedPackageId);
  const hasCustomLogo = Boolean(site?.brandLogoUrl);

  return (
    <div
      className="portal-root relative min-h-dvh overflow-hidden text-slate-900"
      style={{ ["--portal-brand" as string]: brandColor }}
    >
      <style>{`
        @keyframes portal-rise {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes portal-pulse {
          0%, 100% { opacity: 0.45; transform: scale(1); }
          50% { opacity: 0.75; transform: scale(1.04); }
        }
        .portal-rise { animation: portal-rise 0.55s cubic-bezier(0.22, 1, 0.36, 1) both; }
        .portal-rise-delay-1 { animation-delay: 0.08s; }
        .portal-rise-delay-2 { animation-delay: 0.16s; }
        .portal-glow { animation: portal-pulse 8s ease-in-out infinite; }
      `}</style>

      <div className="absolute inset-0 bg-[#061018]" />
      <div
        aria-hidden
        className="portal-glow pointer-events-none absolute -top-32 left-1/2 h-[28rem] w-[36rem] -translate-x-1/2 rounded-full blur-3xl"
        style={{
          background: `radial-gradient(circle, color-mix(in srgb, ${brandColor} 55%, transparent), transparent 70%)`,
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage:
            "radial-gradient(ellipse 70% 60% at 50% 20%, black, transparent)",
        }}
      />

      <div className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pb-8 pt-7 sm:px-5">
        <header className="portal-rise mb-6 text-center text-white">
          <div className="mx-auto mb-4 flex justify-center">
            {hasCustomLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={site!.brandLogoUrl!}
                alt={displayName}
                className="h-14 w-auto max-w-[220px] object-contain drop-shadow-lg"
              />
            ) : (
              <BrandLogo size="lg" />
            )}
          </div>
          <p className="text-[11px] font-semibold tracking-[0.22em] text-white/55 uppercase">
            Internet access
          </p>
          <h1 className="mt-2 font-heading text-3xl font-semibold tracking-[-0.03em] text-white sm:text-[2.1rem]">
            {displayName}
          </h1>
          <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-white/65">
            {site?.location
              ? site.location
              : "Buy a plan with mobile money or redeem a cash voucher."}
          </p>
        </header>

        <div className="portal-rise portal-rise-delay-1 flex flex-1 flex-col">
          {login ? (
            <div className="overflow-hidden rounded-[1.75rem] bg-white shadow-[0_28px_80px_-28px_rgba(0,0,0,0.65)]">
              <AutoLoginForm
                brandColor={brandColor}
                login={login}
                onSubmitted={() => {
                  if (autoLoginUrl && !linkLoginOnly) {
                    window.location.href = autoLoginUrl;
                  }
                }}
              />
            </div>
          ) : (
            <div className="overflow-hidden rounded-[1.75rem] bg-white shadow-[0_28px_80px_-28px_rgba(0,0,0,0.65)]">
              <div className="grid grid-cols-2 border-b border-slate-100">
                {(
                  [
                    { id: "lipa" as const, label: "Pay", icon: Smartphone },
                    { id: "voucher" as const, label: "Voucher", icon: Ticket },
                  ] as const
                ).map((item) => {
                  const active = tab === item.id;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setTab(item.id);
                        setError(null);
                      }}
                      className={cn(
                        "relative flex items-center justify-center gap-2 px-3 py-3.5 text-sm font-medium transition",
                        active ? "text-slate-950" : "text-slate-400 hover:text-slate-600",
                      )}
                    >
                      <Icon className="size-4" />
                      {item.label}
                      {active ? (
                        <span
                          className="absolute inset-x-6 bottom-0 h-0.5 rounded-full"
                          style={{ backgroundColor: brandColor }}
                        />
                      ) : null}
                    </button>
                  );
                })}
              </div>

              <div className="space-y-5 p-5 sm:p-6">
                {error ? (
                  <div
                    role="alert"
                    className="rounded-2xl border border-rose-200/80 bg-rose-50 px-4 py-3 text-sm text-rose-950"
                  >
                    {error}
                  </div>
                ) : null}

                {tab === "lipa" ? (
                  <section className="space-y-5">
                    <div>
                      <div className="mb-3 flex items-end justify-between gap-2">
                        <div>
                          <p className="text-[11px] font-semibold tracking-[0.16em] text-slate-400 uppercase">
                            Choose plan
                          </p>
                          <p className="mt-0.5 text-sm text-slate-500">
                            Select how long you need online
                          </p>
                        </div>
                        <Wifi
                          className="mb-0.5 size-4 opacity-40"
                          style={{ color: brandColor }}
                        />
                      </div>

                      {loading ? (
                        <div className="space-y-2.5">
                          {[0, 1, 2].map((i) => (
                            <div
                              key={i}
                              className="h-[4.5rem] animate-pulse rounded-2xl bg-slate-100"
                            />
                          ))}
                        </div>
                      ) : packages.length === 0 ? (
                        <p className="rounded-2xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                          No packages available right now.
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
                                className={cn(
                                  "group relative w-full overflow-hidden rounded-2xl border px-4 py-3.5 text-left transition duration-200",
                                  selected
                                    ? "border-transparent bg-slate-950 text-white shadow-md"
                                    : "border-slate-200/90 bg-slate-50/80 hover:border-slate-300 hover:bg-white",
                                )}
                              >
                                {selected ? (
                                  <span
                                    className="absolute inset-y-0 left-0 w-1"
                                    style={{ backgroundColor: brandColor }}
                                  />
                                ) : null}
                                <div className="flex items-center justify-between gap-3">
                                  <div className="min-w-0 pl-1">
                                    <p
                                      className={cn(
                                        "font-heading text-[15px] font-semibold tracking-tight",
                                        selected ? "text-white" : "text-slate-900",
                                      )}
                                    >
                                      {pkg.name}
                                    </p>
                                    <p
                                      className={cn(
                                        "mt-0.5 text-xs",
                                        selected ? "text-white/65" : "text-slate-500",
                                      )}
                                    >
                                      {pkg.validityLabel}
                                      {pkg.dataLimitMb
                                        ? ` · ${pkg.dataLimitMb} MB`
                                        : " · Unlimited data"}
                                    </p>
                                    <p
                                      className={cn(
                                        "mt-1 text-[11px]",
                                        selected ? "text-white/45" : "text-slate-400",
                                      )}
                                    >
                                      ↓ {pkg.downloadLabel} · ↑ {pkg.uploadLabel}
                                    </p>
                                  </div>
                                  <div className="shrink-0 text-right">
                                    <p
                                      className={cn(
                                        "font-heading text-lg font-semibold leading-none tracking-tight",
                                        selected ? "text-white" : "text-slate-950",
                                      )}
                                    >
                                      {pkg.priceAmount.toLocaleString("en-TZ")}
                                    </p>
                                    <p
                                      className={cn(
                                        "mt-1 text-[10px] font-medium tracking-wider uppercase",
                                        selected ? "text-white/50" : "text-slate-400",
                                      )}
                                    >
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

                    <div>
                      <p className="mb-2 text-[11px] font-semibold tracking-[0.16em] text-slate-400 uppercase">
                        Mobile network
                      </p>
                      <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
                        {MNO.map((item) => {
                          const active = provider === item.value;
                          return (
                            <button
                              key={item.value}
                              type="button"
                              onClick={() => setProvider(item.value)}
                              className={cn(
                                "flex-1 rounded-lg px-2 py-2 text-xs font-semibold transition",
                                active
                                  ? "bg-white text-slate-950 shadow-sm"
                                  : "text-slate-500 hover:text-slate-700",
                              )}
                            >
                              {item.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid gap-1.5">
                      <Label htmlFor="phone" className="text-slate-600">
                        Phone number
                      </Label>
                      <Input
                        id="phone"
                        inputMode="tel"
                        autoComplete="tel"
                        placeholder="07XX XXX XXX"
                        value={phone}
                        disabled={submitting || waitingPayment}
                        onChange={(e) => setPhone(e.target.value)}
                        className="h-12 rounded-xl border-slate-200 bg-white text-base tracking-wide shadow-none focus-visible:ring-[color:var(--portal-brand)]"
                      />
                    </div>

                    {waitingPayment ? (
                      <div
                        className="flex items-start gap-3 rounded-2xl px-4 py-3.5 text-sm"
                        style={{
                          backgroundColor: `color-mix(in srgb, ${brandColor} 12%, white)`,
                          color: "#0f172a",
                        }}
                      >
                        <Loader2
                          className="mt-0.5 size-4 shrink-0 animate-spin"
                          style={{ color: brandColor }}
                        />
                        <div>
                          <p className="font-medium">Confirm on your phone</p>
                          <p className="mt-0.5 text-xs text-slate-600">
                            Approve the payment prompt, then we will connect you
                            automatically.
                          </p>
                        </div>
                      </div>
                    ) : null}

                    <Button
                      className="h-12 w-full rounded-xl text-[15px] font-semibold text-white shadow-lg transition hover:brightness-110"
                      style={{
                        backgroundColor: brandColor,
                        boxShadow: `0 14px 30px -12px color-mix(in srgb, ${brandColor} 70%, transparent)`,
                      }}
                      disabled={submitting || waitingPayment || !phone.trim()}
                      onClick={() => void submitMobileMoney()}
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          Sending…
                        </>
                      ) : waitingPayment ? (
                        "Waiting…"
                      ) : selectedPkg ? (
                        `Pay ${formatTzs(selectedPkg.priceAmount)}`
                      ) : (
                        "Pay now"
                      )}
                    </Button>
                  </section>
                ) : (
                  <section className="space-y-5">
                    <div>
                      <p className="text-[11px] font-semibold tracking-[0.16em] text-slate-400 uppercase">
                        Cash voucher
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-slate-500">
                        Enter the code from your printed voucher to start browsing.
                      </p>
                    </div>

                    <div className="grid gap-1.5">
                      <Label htmlFor="voucher" className="text-slate-600">
                        Voucher code
                      </Label>
                      <Input
                        id="voucher"
                        placeholder="LCXXXXXXXX"
                        value={voucherCode}
                        disabled={submitting}
                        onChange={(e) =>
                          setVoucherCode(e.target.value.toUpperCase().replace(/\s/g, ""))
                        }
                        className="h-14 rounded-xl border-slate-200 bg-slate-50 text-center font-mono text-xl tracking-[0.28em] shadow-none focus-visible:ring-[color:var(--portal-brand)]"
                      />
                    </div>

                    <Button
                      className="h-12 w-full rounded-xl text-[15px] font-semibold text-white shadow-lg transition hover:brightness-110"
                      style={{
                        backgroundColor: brandColor,
                        boxShadow: `0 14px 30px -12px color-mix(in srgb, ${brandColor} 70%, transparent)`,
                      }}
                      disabled={submitting || voucherCode.trim().length < 4}
                      onClick={() => void submitVoucher()}
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          Verifying…
                        </>
                      ) : (
                        "Connect to Wi‑Fi"
                      )}
                    </Button>
                  </section>
                )}
              </div>
            </div>
          )}
        </div>

        <footer className="portal-rise portal-rise-delay-2 mt-6 space-y-1.5 text-center">
          {(mac || ip) && (
            <p className="truncate font-mono text-[10px] tracking-wide text-white/30">
              {[mac && `MAC ${mac}`, ip && `IP ${ip}`].filter(Boolean).join(" · ")}
            </p>
          )}
          <p className="text-[11px] text-white/40">
            Powered by <span className="text-white/55">Lets Connect</span>
          </p>
        </footer>
      </div>
    </div>
  );
}
