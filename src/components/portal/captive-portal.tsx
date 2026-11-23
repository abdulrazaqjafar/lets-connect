"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Radio, Signal, Wifi } from "lucide-react";
import {
  AutoLoginForm,
  type MikroTikLoginPayload,
} from "@/components/portal/auto-login-form";
import {
  PaymentModal,
  type PortalPackageOption,
} from "@/components/portal/payment-modal";
import { Button } from "@/components/ui/button";

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

  const loadPackages = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    if (!mac || !linkLoginOnly) {
      setLoadError(
        "This page must be opened from the Wi‑Fi hotspot (missing mac or link-login-only).",
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
    <div className="portal-shell relative min-h-dvh overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(13,148,136,0.18),_transparent_55%),linear-gradient(180deg,#f4faf9_0%,#eef6f4_45%,#f7faf9_100%)]" />
      <div className="pointer-events-none absolute -top-24 right-[-20%] h-64 w-64 rounded-full bg-teal-400/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-10%] left-[-15%] h-56 w-56 rounded-full bg-cyan-300/20 blur-3xl" />

      <div className="relative mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 pb-8 pt-6 sm:px-6">
        <header className="mb-6 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-teal-800/70 uppercase">
              Lets Connect
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              {site?.name ?? "Wi‑Fi access"}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Pick a plan and pay instantly with mobile money.
            </p>
          </div>
          <div className="flex size-11 items-center justify-center rounded-2xl bg-teal-700 text-white shadow-sm">
            <Wifi className="size-5" />
          </div>
        </header>

        {(mikrotikError || loadError) && (
          <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            {mikrotikError ? <p>Router: {mikrotikError}</p> : null}
            {loadError ? <p>{loadError}</p> : null}
          </div>
        )}

        {login ? (
          <AutoLoginForm login={login} />
        ) : (
          <>
            <div className="mb-4 flex flex-wrap gap-2 text-xs text-slate-600">
              {mac ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2.5 py-1 ring-1 ring-slate-200">
                  <Signal className="size-3.5" />
                  {mac}
                </span>
              ) : null}
              {clientIp ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2.5 py-1 ring-1 ring-slate-200">
                  <Radio className="size-3.5" />
                  {clientIp}
                </span>
              ) : null}
            </div>

            <section className="flex-1 space-y-3">
              {loading ? (
                <div className="space-y-3">
                  {[0, 1, 2].map((key) => (
                    <div
                      key={key}
                      className="h-28 animate-pulse rounded-2xl bg-white/70 ring-1 ring-slate-200/80"
                    />
                  ))}
                </div>
              ) : packages.length === 0 ? (
                <div className="rounded-2xl bg-white/80 px-4 py-8 text-center text-sm text-slate-600 ring-1 ring-slate-200">
                  No active packages for this hotspot yet.
                </div>
              ) : (
                packages.map((pkg, index) => (
                  <button
                    key={pkg.id}
                    type="button"
                    onClick={() => {
                      setSelected(pkg);
                      setPayOpen(true);
                    }}
                    className="group w-full rounded-2xl bg-white/90 p-4 text-left shadow-sm ring-1 ring-slate-200/90 transition hover:-translate-y-0.5 hover:shadow-md hover:ring-teal-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
                    style={{ animationDelay: `${index * 60}ms` }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">{pkg.name}</p>
                        <p className="mt-0.5 text-sm text-slate-600">
                          {pkg.validityLabel}
                          {pkg.dataLimitMb ? ` · ${pkg.dataLimitMb} MB` : ""}
                        </p>
                        <p className="mt-2 text-xs text-slate-500">
                          ↓ {pkg.downloadLabel} · ↑ {pkg.uploadLabel}
                        </p>
                      </div>
                      <div className="rounded-xl bg-teal-700 px-3 py-2 text-right text-white">
                        <p className="text-lg font-semibold leading-none">
                          {pkg.priceAmount}
                        </p>
                        <p className="mt-1 text-[10px] tracking-wide uppercase opacity-90">
                          {pkg.priceCurrency}
                        </p>
                      </div>
                    </div>
                    {pkg.description ? (
                      <p className="mt-3 text-sm text-slate-600">{pkg.description}</p>
                    ) : null}
                  </button>
                ))
              )}
            </section>

            <div className="mt-6">
              <Button
                variant="outline"
                className="w-full bg-white/70"
                onClick={() => void loadPackages()}
                disabled={loading}
              >
                Refresh plans
              </Button>
            </div>
          </>
        )}
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
