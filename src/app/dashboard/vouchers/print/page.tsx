"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import { toast } from "sonner";
import {
  VoucherPrintCard,
  type PrintableVoucher,
} from "@/components/vouchers/voucher-print-card";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ApiVoucher = {
  id: string;
  code: string;
  batchId: string | null;
  package: PrintableVoucher["package"];
};

function PrintVouchersContent() {
  const searchParams = useSearchParams();
  const siteId = searchParams.get("siteId") ?? "";
  const batchId = searchParams.get("batchId");

  const [siteName, setSiteName] = useState("Hotspot");
  const [vouchers, setVouchers] = useState<PrintableVoucher[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!siteId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [sitesRes, vouchersRes] = await Promise.all([
        fetch("/api/sites"),
        fetch(
          `/api/sites/${siteId}/vouchers?limit=500${
            batchId ? `&batchId=${encodeURIComponent(batchId)}` : ""
          }`,
        ),
      ]);

      const sitesPayload = await sitesRes.json().catch(() => ({}));
      const vouchersPayload = await vouchersRes.json().catch(() => ({}));

      if (!vouchersRes.ok) {
        toast.error(vouchersPayload.error ?? "Failed to load vouchers");
        setLoading(false);
        return;
      }

      const site = (sitesPayload.sites ?? []).find(
        (s: { id: string; name: string }) => s.id === siteId,
      );
      setSiteName(site?.name ?? "Hotspot");

      const rows = ((vouchersPayload.vouchers ?? []) as ApiVoucher[]).map(
        (voucher) => ({
          id: voucher.id,
          code: voucher.code,
          siteName: site?.name ?? "Hotspot",
          package: voucher.package,
        }),
      );
      setVouchers(rows);
    } finally {
      setLoading(false);
    }
  }, [siteId, batchId]);

  useEffect(() => {
    void load();
  }, [load]);

  const subtitle = useMemo(() => {
    if (batchId) return `Batch ${batchId.slice(0, 8)}… · ${vouchers.length} cards`;
    return `${vouchers.length} voucher card${vouchers.length === 1 ? "" : "s"}`;
  }, [batchId, vouchers.length]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 print:hidden sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link
              href={`/dashboard/vouchers${siteId ? `?siteId=${siteId}` : ""}`}
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
            >
              <ArrowLeft className="size-4" />
              Back
            </Link>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Print vouchers</h1>
          <p className="text-sm text-muted-foreground">
            A4 cut-sheet / thermal-friendly cards for {siteName}. {subtitle}
          </p>
        </div>
        <Button
          disabled={vouchers.length === 0}
          onClick={() => window.print()}
          className="bg-teal-700 text-white hover:bg-teal-800"
        >
          <Printer className="size-4" />
          Print
        </Button>
      </div>

      {!siteId ? (
        <p className="text-sm text-muted-foreground print:hidden">
          Select a site from the vouchers page, then open Print layout.
        </p>
      ) : loading ? (
        <p className="text-sm text-muted-foreground print:hidden">Loading vouchers…</p>
      ) : vouchers.length === 0 ? (
        <p className="text-sm text-muted-foreground print:hidden">
          No vouchers to print for this selection.
        </p>
      ) : (
        <div className="voucher-print-grid grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {vouchers.map((voucher) => (
            <VoucherPrintCard key={voucher.id} voucher={voucher} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function PrintVouchersPage() {
  return (
    <Suspense
      fallback={
        <p className="text-sm text-muted-foreground">Loading print layout…</p>
      }
    >
      <PrintVouchersContent />
    </Suspense>
  );
}
