"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { VouchersManager } from "@/components/vouchers/vouchers-manager";

function VouchersPageContent() {
  const searchParams = useSearchParams();
  const siteId = searchParams.get("siteId") ?? undefined;
  return <VouchersManager initialSiteId={siteId} />;
}

export default function VouchersPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading vouchers…</p>}>
      <VouchersPageContent />
    </Suspense>
  );
}
