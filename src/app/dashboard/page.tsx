"use client";

import Link from "next/link";
import { ArrowUpRight, Router, Ticket } from "lucide-react";
import { AnalyticsOverview } from "@/components/dashboard/analytics-overview";
import { PageHeader } from "@/components/dashboard/page-header";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function DashboardOverviewPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Command center"
        title="Analytics"
        description="Revenue, live sessions, and voucher performance across your hotspot network."
      />

      <AnalyticsOverview />

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/dashboard/vouchers"
          className="lc-panel lc-metric-card group rounded-2xl p-5 transition"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700 ring-1 ring-teal-100">
              <Ticket className="size-4" />
            </div>
            <ArrowUpRight className="size-4 text-slate-300 transition group-hover:text-teal-600" />
          </div>
          <h2 className="mt-4 font-heading text-lg font-semibold tracking-tight text-slate-900">
            Cash vouchers
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-500">
            Generate unused stock and print A4 / thermal cut sheets for counter sales.
          </p>
          <span
            className={cn(
              buttonVariants({
                size: "sm",
                className: "mt-4 bg-teal-700 text-white hover:bg-teal-800",
              }),
            )}
          >
            Open generator
          </span>
        </Link>

        <Link
          href="/dashboard/router-setup"
          className="lc-panel lc-metric-card group rounded-2xl p-5 transition"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700 ring-1 ring-slate-200">
              <Router className="size-4" />
            </div>
            <ArrowUpRight className="size-4 text-slate-300 transition group-hover:text-teal-600" />
          </div>
          <h2 className="mt-4 font-heading text-lg font-semibold tracking-tight text-slate-900">
            Router setup
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-500">
            Provision MikroTik Hotspot, walled garden, and RADIUS from one script.
          </p>
          <span
            className={cn(
              buttonVariants({
                size: "sm",
                variant: "outline",
                className: "mt-4",
              }),
            )}
          >
            Open Router Setup
          </span>
        </Link>
      </div>
    </div>
  );
}
