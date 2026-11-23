"use client";

import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { DashboardTopbar } from "@/components/dashboard/dashboard-topbar";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="lc-app-shell min-h-dvh print:bg-white">
      <DashboardSidebar />
      <div className="md:pl-[17.5rem] print:pl-0">
        <DashboardTopbar />
        <main className="lc-main mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8 print:max-w-none print:px-0 print:py-0">
          {children}
        </main>
      </div>
    </div>
  );
}
