"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  Cable,
  CreditCard,
  Headphones,
  LayoutDashboard,
  LogOut,
  MapPinned,
  Network,
  Package,
  Router,
  Ticket,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BrandLogo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

type NavLink = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
  cashierOk?: boolean;
};

type NavSection = {
  title: string;
  links: NavLink[];
};

const sections: NavSection[] = [
  {
    title: "Overview",
    links: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true },
    ],
  },
  {
    title: "Hotspot",
    links: [
      { href: "/dashboard/packages", label: "Packages", icon: Package },
      { href: "/dashboard/vouchers", label: "Vouchers", icon: Ticket, cashierOk: true },
      { href: "/dashboard/staff", label: "Agents / Staff", icon: Users },
      {
        href: "/dashboard/online-users",
        label: "Online users",
        icon: Activity,
      },
    ],
  },
  {
    title: "Network",
    links: [
      { href: "/dashboard/sites", label: "Sites / Routers", icon: MapPinned },
      { href: "/dashboard/router-setup", label: "Router assistant", icon: Router },
      { href: "/dashboard/network", label: "Network map", icon: Network },
      { href: "/dashboard/pppoe", label: "PPPoE", icon: Cable },
    ],
  },
  {
    title: "Account",
    links: [
      { href: "/dashboard/support", label: "Tickets", icon: Headphones },
      { href: "/dashboard/billing", label: "Subscription", icon: CreditCard },
    ],
  },
];

export function DashboardSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [role, setRole] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/auth/me");
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        router.replace("/login");
        return;
      }
      setRole(payload.user?.role ?? "SITE_OWNER");
      setLocked(Boolean(payload.locked));
      if (payload.user?.role === "CASHIER" && !pathname.startsWith("/dashboard/vouchers")) {
        router.replace("/dashboard/vouchers");
      } else if (
        payload.locked &&
        payload.user?.role !== "CASHIER" &&
        !pathname.startsWith("/dashboard/billing")
      ) {
        router.replace("/dashboard/billing");
      }
    })();
  }, [pathname, router]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    toast.success("Signed out");
    router.push("/login");
    router.refresh();
  }

  const isCashier = role === "CASHIER";

  return (
    <aside className="print:hidden lc-sidebar flex w-full flex-col md:fixed md:inset-y-0 md:w-[17.5rem]">
      <div className="border-b border-white/8 px-4 py-4">
        <BrandLogo inverted size="md" className="w-full justify-center" />
      </div>

      <div className="px-3 pt-4 md:flex-1 md:overflow-y-auto">
        {isCashier || locked ? (
          <p className="mb-2 px-3 text-[10px] font-semibold tracking-[0.18em] text-slate-500 uppercase">
            {isCashier ? "Cash desk" : "Billing only"}
          </p>
        ) : null}

        <nav className="flex gap-1 overflow-x-auto pb-3 md:flex-col md:overflow-visible md:pb-0">
          {sections.map((section) => {
            const links = section.links.filter((link) => {
              if (isCashier) return link.cashierOk;
              if (locked) return link.href === "/dashboard/billing";
              return true;
            });
            if (links.length === 0) return null;

            return (
              <div key={section.title} className="mb-3 hidden md:block">
                {!isCashier && !locked ? (
                  <p className="mb-1.5 px-3 text-[10px] font-semibold tracking-[0.16em] text-slate-500 uppercase">
                    {section.title}
                  </p>
                ) : null}
                <div className="flex flex-col gap-0.5">
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
                          "group relative inline-flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-all duration-200",
                          active
                            ? "bg-white/8 font-medium text-white shadow-[inset_0_0_0_1px_rgba(247,142,30,0.35)]"
                            : "text-slate-400 hover:bg-white/5 hover:text-slate-100",
                        )}
                      >
                        {active ? (
                          <span className="absolute top-1/2 left-0 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-[#F78E1E]" />
                        ) : null}
                        <span
                          className={cn(
                            "flex size-7 items-center justify-center rounded-lg transition",
                            active
                              ? "bg-orange-400/15 text-[#F78E1E]"
                              : "bg-white/4 text-slate-500 group-hover:text-slate-300",
                          )}
                        >
                          <Icon className="size-3.5" />
                        </span>
                        {link.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Mobile: flat list */}
          <div className="flex gap-1 md:hidden">
            {sections
              .flatMap((s) => s.links)
              .filter((link) => {
                if (isCashier) return link.cashierOk;
                if (locked) return link.href === "/dashboard/billing";
                return true;
              })
              .map((link) => {
                const Icon = link.icon;
                const active = link.exact
                  ? pathname === link.href
                  : pathname === link.href || pathname.startsWith(`${link.href}/`);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs",
                      active ? "bg-white/10 text-white" : "text-slate-400",
                    )}
                  >
                    <Icon className="size-3.5" />
                    {link.label}
                  </Link>
                );
              })}
          </div>
        </nav>
      </div>

      <div className="mt-auto hidden space-y-3 border-t border-white/8 p-4 md:block">
        <div className="rounded-2xl bg-gradient-to-br from-orange-500/15 via-transparent to-transparent p-3 ring-1 ring-orange-400/20">
          <p className="text-xs font-semibold text-orange-100">
            {isCashier ? "Cashier access" : locked ? "Renew to unlock" : "Lets Connect"}
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
            {isCashier
              ? "Create and print cash vouchers for your assigned sites."
              : locked
                ? "Sites and Wi‑Fi portal are paused until you pay."
                : "Hotspot, vouchers, and MikroTik one-line install."}
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
