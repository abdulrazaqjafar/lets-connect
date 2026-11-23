"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Wifi } from "lucide-react";
import {
  AutoLoginForm,
  type MikroTikLoginPayload,
} from "@/components/portal/auto-login-form";
import {
  PaymentModal,
  type PortalPackageOption,
} from "@/components/portal/payment-modal";
import { BrandLogo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PortalSite = {
  id: string;
  name: string;
  slug: string;
  nasIdentifier: string;
};

type CaptivePortalProps = {
  initialQuery: string;
};

export function CaptivePortal({ initialQuery }: CaptivePortalProps) {
  const search = useMemo(() => new URLSearchParams(initialQuery), [initialQuery]);

  const mac = search.get("mac") ?? "";
  const linkLoginOnly = search.get("link-login-only") ?? "";
  const clientIp = search.get("ip");
  const chapId = search.get("chap-id");
  const chapChallenge = search.get("chap-challenge");
  const linkOrig = search.get("link-orig") ?? search.get("dst");
  const mikrotikError = search.get("error");

  const [site, setSite] = useState<PortalSite | null>(null);
  const [packages, setPackages] = useState<PortalPackageOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<PortalPackageOption | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [login, setLogin] = useState<MikroTikLoginPayload | null>(null);

  const brandColor = "#14b8a6";

  const loadPackages = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    if (!mac || !linkLoginOnly) {
      setLoadError(
        "Open this page from the Wi‑Fi hotspot (missing redirect parameters).",
      );
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`/api/portal/packages?${search.toString()}`);
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to load packages");
      }
      setSite(payload.site);
      setPackages(payload.packages ?? []);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Failed to load packages");
    } finally {
      setLoading(false);
    }
  }, [mac, linkLoginOnly, search]);

  useEffect(() => {
    void loadPackages();
  }, [loadPackages]);

  return (
    <div className="relative min-h-dvh overflow-hidden">
      <div className="absolute inset-0 bg-[#061018]" />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 h-[28rem] w-[36rem] -translate-x-1/2 rounded-full blur-3xl"
        style={{
          background: `radial-gradient(circle, color-mix(in srgb, ${brandColor} 55%, transparent), transparent 70%)`,
        }}
      />

      <div className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pb-8 pt-7 sm:px-5">
        <header className="mb-6 text-center text-white">
          <div className="mx-auto mb-4 inline-flex rounded-2xl bg-white/95 px-4 py-2.5 shadow-lg">
            <BrandLogo />
          </div>
          <p className="text-[11px] font-semibold tracking-[0.22em] text-white/55 uppercase">
            Internet access
          </p>
          <h1 className="mt-2 font-heading text-3xl font-semibold tracking-[-0.03em]">
            {site?.name ?? "Wi‑Fi access"}
          </h1>
          <p className="mx-auto mt-2 max-w-xs text-sm text-white/65">
            Pick a plan and pay with mobile money.
          </p>
        </header>

        {(mikrotikError || loadError) && (
          <div className="mb-4 rounded-2xl border border-amber-200/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-50">
            {mikrotikError ? <p>Router: {mikrotikError}</p> : null}
            {loadError ? <p>{loadError}</p> : null}
          </div>
        )}

        <div className="overflow-hidden rounded-[1.75rem] bg-white shadow-[0_28px_80px_-28px_rgba(0,0,0,0.65)]">
          {login ? (
            <AutoLoginForm login={login} brandColor={brandColor} />
          ) : (
            <div className="space-y-4 p-5 sm:p-6">
              <div className="flex items-end justify-between gap-2">
                <div>
                  <p className="text-[11px] font-semibold tracking-[0.16em] text-slate-400 uppercase">
                    Choose plan
                  </p>
                  <p className="mt-0.5 text-sm text-slate-500">
                    Tap a plan to pay and connect
                  </p>
                </div>
                <Wifi className="mb-0.5 size-4 text-teal-500/50" />
              </div>

              {loading ? (
                <div className="space-y-2.5">
                  {[0, 1, 2].map((key) => (
                    <div
                      key={key}
                      className="h-[4.5rem] animate-pulse rounded-2xl bg-slate-100"
                    />
                  ))}
                </div>
              ) : packages.length === 0 ? (
                <p className="rounded-2xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                  No active packages for this hotspot yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {packages.map((pkg) => (
                    <button
                      key={pkg.id}
                      type="button"
                      onClick={() => {
                        setSelected(pkg);
                        setPayOpen(true);
                      }}
                      className={cn(
                        "group w-full rounded-2xl border border-slate-200/90 bg-slate-50/80 px-4 py-3.5 text-left transition duration-200",
                        "hover:border-slate-300 hover:bg-white",
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-heading text-[15px] font-semibold tracking-tight text-slate-900">
                            {pkg.name}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {pkg.validityLabel}
                            {pkg.dataLimitMb
                              ? ` · ${pkg.dataLimitMb} MB`
                              : " · Unlimited data"}
                          </p>
                          <p className="mt-1 text-[11px] text-slate-400">
                            ↓ {pkg.downloadLabel} · ↑ {pkg.uploadLabel}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="font-heading text-lg font-semibold leading-none text-slate-950">
                            {pkg.priceAmount.toLocaleString("en-TZ")}
                          </p>
                          <p className="mt-1 text-[10px] font-medium tracking-wider text-slate-400 uppercase">
                            {pkg.priceCurrency}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              <Button
                variant="outline"
                className="h-11 w-full rounded-xl border-slate-200"
                onClick={() => void loadPackages()}
                disabled={loading}
              >
                Refresh plans
              </Button>
            </div>
          )}
        </div>

        <footer className="mt-6 space-y-1.5 text-center">
          {(mac || clientIp) && (
            <p className="truncate font-mono text-[10px] tracking-wide text-white/30">
              {[mac && `MAC ${mac}`, clientIp && `IP ${clientIp}`]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
          <p className="text-[11px] text-white/40">
            Powered by <span className="text-white/55">Lets Connect</span>
          </p>
        </footer>
      </div>

      {site ? (
        <PaymentModal
          open={payOpen}
          onOpenChange={setPayOpen}
          siteId={site.id}
          pkg={selected}
          mac={mac}
          linkLoginOnly={linkLoginOnly}
          clientIp={clientIp}
          chapId={chapId}
          chapChallenge={chapChallenge}
          linkOrig={linkOrig}
          onPaid={setLogin}
        />
      ) : null}
    </div>
  );
}
