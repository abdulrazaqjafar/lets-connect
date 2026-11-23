"use client";

import { usePathname } from "next/navigation";
import { Bell, Search } from "lucide-react";

const titles: Record<string, string> = {
  "/dashboard": "Operations overview",
  "/dashboard/sites": "Sites",
  "/dashboard/packages": "Packages",
  "/dashboard/vouchers": "Cash vouchers",
  "/dashboard/vouchers/print": "Print layout",
  "/dashboard/router-setup": "Router setup",
  "/dashboard/billing": "Subscriptions",
};

function resolveTitle(pathname: string) {
  if (titles[pathname]) return titles[pathname];
  const match = Object.keys(titles)
    .filter((key) => key !== "/dashboard" && pathname.startsWith(key))
    .sort((a, b) => b.length - a.length)[0];
  return match ? titles[match] : "Dashboard";
}

export function DashboardTopbar() {
  const pathname = usePathname();
  const title = resolveTitle(pathname);

  return (
    <header className="print:hidden sticky top-0 z-20 border-b border-slate-200/70 bg-[#f4f7f6]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-800">{title}</p>
          <p className="hidden text-[11px] text-slate-500 sm:block">
            Africa/Dar_es_Salaam · Live network
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-slate-400 shadow-sm md:flex">
            <Search className="size-3.5" />
            <span className="text-xs">Search sites, vouchers…</span>
            <kbd className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
              ⌘K
            </kbd>
          </div>
          <button
            type="button"
            className="inline-flex size-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:text-slate-800"
            aria-label="Notifications"
          >
            <Bell className="size-4" />
          </button>
          <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pr-3 pl-1 shadow-sm">
            <div className="flex size-7 items-center justify-center rounded-full bg-gradient-to-br from-teal-600 to-slate-800 text-[10px] font-semibold text-white">
              LC
            </div>
            <div className="hidden leading-tight sm:block">
              <p className="text-xs font-semibold text-slate-800">Site Owner</p>
              <p className="text-[10px] text-slate-500">Operator</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
