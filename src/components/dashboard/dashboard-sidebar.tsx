"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  CreditCard,
  LayoutDashboard,
  LogOut,
  MapPinned,
  Package,
  Router,
  Ticket,
} from "lucide-react";
import { toast } from "sonner";
import { BrandLogo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

const links = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/sites", label: "Sites", icon: MapPinned },
  { href: "/dashboard/packages", label: "Packages", icon: Package },
  { href: "/dashboard/vouchers", label: "Vouchers", icon: Ticket },
  { href: "/dashboard/router-setup", label: "Router setup", icon: Router },
  { href: "/dashboard/billing", label: "Subscriptions", icon: CreditCard },
];

export function DashboardSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    toast.success("Signed out");
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="print:hidden lc-sidebar flex w-full flex-col md:fixed md:inset-y-0 md:w-[17.5rem]">
      <div className="border-b border-white/8 px-5 py-5">
        <BrandLogo inverted />
      </div>

      <div className="px-3 pt-4 md:flex-1">
        <p className="mb-2 px-3 text-[10px] font-semibold tracking-[0.18em] text-slate-500 uppercase">
          Workspace
        </p>
        <nav className="flex gap-1 overflow-x-auto pb-3 md:flex-col md:overflow-visible md:pb-0">
          {links.map((link) => {
            const Icon = link.icon;
            const active = link.exact
              ? pathname === link.href
              : pathname === link.href || pathname.startsWith(`${link.href}/`);

            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "group relative inline-flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-all duration-200",
                  active
                    ? "bg-white/8 font-medium text-white shadow-[inset_0_0_0_1px_rgba(45,212,191,0.22)]"
                    : "text-slate-400 hover:bg-white/5 hover:text-slate-100",
                )}
              >
                {active ? (
                  <span className="absolute top-1/2 left-0 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-teal-400" />
                ) : null}
                <span
                  className={cn(
                    "flex size-7 items-center justify-center rounded-lg transition",
                    active
                      ? "bg-teal-400/15 text-teal-300"
                      : "bg-white/4 text-slate-500 group-hover:text-slate-300",
                  )}
                >
                  <Icon className="size-3.5" />
                </span>
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="mt-auto hidden space-y-3 border-t border-white/8 p-4 md:block">
        <div className="rounded-2xl bg-gradient-to-br from-teal-500/15 via-transparent to-transparent p-3 ring-1 ring-teal-400/20">
          <p className="text-xs font-semibold text-teal-200">Account protected</p>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
            Sign-in required. Site limits follow your subscription plan.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void logout()}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-400 transition hover:bg-white/5 hover:text-white"
        >
          <LogOut className="size-3.5" />
          Logout
        </button>
      </div>
    </aside>
  );
}
