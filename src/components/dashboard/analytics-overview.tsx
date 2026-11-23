"use client";

import { useEffect, useState } from "react";
import { Activity, Banknote, Package, Ticket } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DashboardAnalytics } from "@/lib/analytics-types";
import { formatTzs } from "@/lib/money";
import { cn } from "@/lib/utils";

const empty: DashboardAnalytics = {
  currency: "TZS",
  totalRevenue: 0,
  activeOnlineUsers: 0,
  vouchersSold: 0,
  vouchersAvailable: 0,
  topPackages: [],
  dailyRevenue: [],
};

export function AnalyticsOverview() {
  const [data, setData] = useState<DashboardAnalytics>(empty);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch("/api/analytics");
        const payload = await response.json().catch(() => ({}));
        if (response.ok) {
          setData(payload as DashboardAnalytics);
        }
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  const metrics = [
    {
      title: "Total revenue",
      value: formatTzs(data.totalRevenue),
      hint: "Successful payments",
      icon: Banknote,
      tone: "from-teal-500/12 to-transparent",
    },
    {
      title: "Active online",
      value: String(data.activeOnlineUsers),
      hint: "RADIUS sessions now",
      icon: Activity,
      tone: "from-cyan-500/12 to-transparent",
    },
    {
      title: "Vouchers sold",
      value: String(data.vouchersSold),
      hint: "Sold + active codes",
      icon: Ticket,
      tone: "from-emerald-500/12 to-transparent",
    },
    {
      title: "Unused stock",
      value: String(data.vouchersAvailable),
      hint: "Ready to print / sell",
      icon: Package,
      tone: "from-slate-500/10 to-transparent",
    },
  ];

  const chartData = data.dailyRevenue.map((row) => ({
    ...row,
    label: row.date.slice(5),
  }));

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <div
              key={metric.title}
              className={cn(
                "lc-panel lc-metric-card rounded-2xl bg-gradient-to-br p-4",
                metric.tone,
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-medium tracking-wide text-slate-500 uppercase">
                    {metric.hint}
                  </p>
                  <p className="mt-2 font-heading text-2xl font-semibold tracking-tight text-slate-950 tabular-nums">
                    {loading ? "…" : metric.value}
                  </p>
                </div>
                <div className="flex size-9 items-center justify-center rounded-xl bg-white/80 text-teal-700 ring-1 ring-slate-200/80">
                  <Icon className="size-4" />
                </div>
              </div>
              <p className="mt-3 text-sm font-medium text-slate-700">{metric.title}</p>
            </div>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lc-panel rounded-2xl p-5 lg:col-span-3">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <h2 className="font-heading text-base font-semibold tracking-tight text-slate-900">
                Revenue trend
              </h2>
              <p className="text-sm text-slate-500">Daily income · last 30 days</p>
            </div>
            <p className="text-xs font-medium text-teal-700 tabular-nums">
              {loading ? "…" : formatTzs(data.totalRevenue)} total
            </p>
          </div>
          <div className="h-72">
            {loading ? (
              <p className="text-sm text-slate-500">Loading chart…</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ left: 4, right: 8, top: 8 }}>
                  <defs>
                    <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0f766e" stopOpacity={0.32} />
                      <stop offset="100%" stopColor="#0f766e" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    tickLine={false}
                    axisLine={false}
                    minTickGap={24}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    tickLine={false}
                    axisLine={false}
                    width={56}
                    tickFormatter={(value: number) =>
                      value >= 1000 ? `${Math.round(value / 1000)}k` : String(value)
                    }
                  />
                  <Tooltip
                    formatter={(value) => [formatTzs(Number(value ?? 0)), "Revenue"]}
                    labelFormatter={(label, payload) =>
                      payload?.[0]?.payload?.date ?? String(label)
                    }
                    contentStyle={{
                      borderRadius: 14,
                      borderColor: "#e2e8f0",
                      fontSize: 12,
                      boxShadow: "0 12px 30px -18px rgba(15,23,42,0.35)",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#0f766e"
                    strokeWidth={2.25}
                    fill="url(#revenueFill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="lc-panel rounded-2xl p-5 lg:col-span-2">
          <h2 className="font-heading text-base font-semibold tracking-tight text-slate-900">
            Top packages
          </h2>
          <p className="mb-4 text-sm text-slate-500">Best sellers by revenue</p>
          {loading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : data.topPackages.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-8 text-center">
              <p className="text-sm text-slate-500">
                No sales yet. Generate cash stock or wait for portal payments.
              </p>
            </div>
          ) : (
            <ul className="space-y-2.5">
              {data.topPackages.map((pkg, index) => (
                <li
                  key={pkg.packageId}
                  className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5"
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-white text-xs font-semibold text-slate-500 ring-1 ring-slate-200">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{pkg.name}</p>
                    <p className="truncate text-xs text-slate-500">
                      {pkg.siteName} · {pkg.soldCount} sold
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold tabular-nums text-teal-800">
                    {formatTzs(pkg.revenue)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
