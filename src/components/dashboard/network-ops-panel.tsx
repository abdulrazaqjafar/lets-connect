"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, Radio, RefreshCw, Router, Wallet } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { formatTzs } from "@/lib/money";
import type { NetworkOverview } from "@/lib/network-overview";

function formatBytes(value: string | null | undefined) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatDuration(sec: number | null) {
  if (sec == null) return "—";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function NetworkOpsPanel() {
  const [data, setData] = useState<NetworkOverview | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/network/overview");
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error ?? "Failed to load network");
      setData(payload);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 30000);
    return () => clearInterval(id);
  }, [load]);

  const totals = data?.totals;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operations"
        title="Live network"
        description="Sessions, bandwidth, router health, and today’s collections."
        actions={
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Active sessions",
            value: totals?.activeSessions ?? "—",
            icon: Activity,
          },
          {
            label: "Bandwidth out",
            value: formatBytes(totals?.bytesOut),
            icon: Radio,
          },
          {
            label: "Routers online",
            value:
              totals != null
                ? `${totals.routersOnline}/${totals.routersTotal}`
                : "—",
            icon: Router,
          },
          {
            label: "Collections today",
            value: totals != null ? formatTzs(totals.collectionsTodayTzs) : "—",
            icon: Wallet,
          },
        ].map((card) => (
          <div key={card.label} className="lc-panel rounded-2xl p-4">
            <div className="flex items-center gap-2 text-slate-500">
              <card.icon className="size-3.5" />
              <p className="text-[11px] font-semibold tracking-wide uppercase">
                {card.label}
              </p>
            </div>
            <p className="mt-2 font-heading text-2xl font-semibold text-slate-900">
              {card.value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="lc-panel rounded-2xl p-5">
          <h2 className="font-heading text-base font-semibold text-slate-900">
            Live sessions
          </h2>
          <p className="text-sm text-slate-500">From FreeRADIUS accounting</p>
          <div className="mt-4 max-h-80 space-y-2 overflow-y-auto">
            {(data?.sessions ?? []).length === 0 ? (
              <p className="text-sm text-slate-500">No active sessions.</p>
            ) : (
              data?.sessions.map((s) => (
                <div
                  key={`${s.siteId}-${s.username}-${s.mac}`}
                  className="rounded-xl border border-slate-200/80 px-3 py-2 text-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-slate-900">{s.username}</p>
                    <span className="text-xs text-slate-500">
                      {formatDuration(s.sessionTimeSec)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    {s.siteName} · {s.mac ?? "—"} · ↓{formatBytes(s.bytesIn)} ↑
                    {formatBytes(s.bytesOut)}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="lc-panel rounded-2xl p-5">
          <h2 className="font-heading text-base font-semibold text-slate-900">
            Router health
          </h2>
          <p className="text-sm text-slate-500">
            RouterOS API probe (configure host + credentials on each site)
          </p>
          <div className="mt-4 max-h-80 space-y-2 overflow-y-auto">
            {(data?.routers ?? []).length === 0 ? (
              <p className="text-sm text-slate-500">No sites yet.</p>
            ) : (
              data?.routers.map((r) => (
                <div
                  key={r.siteId}
                  className="rounded-xl border border-slate-200/80 px-3 py-2 text-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-slate-900">{r.siteName}</p>
                    <span
                      className={
                        r.status === "online"
                          ? "text-teal-700"
                          : r.status === "offline"
                            ? "text-rose-600"
                            : "text-slate-500"
                      }
                    >
                      {r.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    {r.host ?? "No API host"}
                    {r.uptime ? ` · up ${r.uptime}` : ""}
                    {r.cpuLoad != null ? ` · CPU ${r.cpuLoad}%` : ""}
                    {r.error ? ` · ${r.error}` : ""}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <section className="lc-panel rounded-2xl p-5">
        <h2 className="font-heading text-base font-semibold text-slate-900">
          Payment collections
        </h2>
        <p className="text-sm text-slate-500">Successful portal sales today</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs tracking-wide text-slate-500 uppercase">
              <tr>
                <th className="pb-2 font-medium">Site</th>
                <th className="pb-2 font-medium">Amount</th>
                <th className="pb-2 font-medium">Provider</th>
                <th className="pb-2 font-medium">When</th>
              </tr>
            </thead>
            <tbody>
              {(data?.collections ?? []).length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-4 text-slate-500">
                    No collections yet today.
                  </td>
                </tr>
              ) : (
                data?.collections.map((c) => (
                  <tr key={c.id} className="border-t border-slate-100">
                    <td className="py-2">{c.siteName}</td>
                    <td className="py-2">{formatTzs(c.amount)}</td>
                    <td className="py-2">{c.provider}</td>
                    <td className="py-2 text-slate-500">
                      {new Date(c.paidAt ?? c.createdAt).toLocaleTimeString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
