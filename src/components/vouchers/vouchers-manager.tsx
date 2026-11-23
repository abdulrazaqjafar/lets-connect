"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Printer, Ticket } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/dashboard/page-header";
import { SitePicker, type SiteOption } from "@/components/dashboard/site-picker";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatValidity } from "@/lib/packages";
import { cn } from "@/lib/utils";
import { bulkVoucherSchema, type BulkVoucherValues } from "@/lib/vouchers";

type PackageOption = {
  id: string;
  name: string;
  priceAmount: number;
  priceCurrency: string;
  isActive: boolean;
  validityValue: number;
  validityUnit: "HOURS" | "DAYS";
};

type VoucherRow = {
  id: string;
  code: string;
  status: string;
  batchId: string | null;
  expiresAt: string | null;
  createdAt: string;
  package: {
    id: string;
    name: string;
    priceAmount: number;
    priceCurrency: string;
    validityValue: number;
    validityUnit: "HOURS" | "DAYS";
  };
};

const generatorDefaults: BulkVoucherValues = {
  packageId: "",
  quantity: 50,
  prefix: "",
  codeLength: 6,
  shelfLifeDays: 90,
  notes: "",
};

function statusLabel(status: string) {
  if (status === "AVAILABLE") return "Unused";
  return status;
}

export function VouchersManager({ initialSiteId }: { initialSiteId?: string }) {
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [siteId, setSiteId] = useState(initialSiteId ?? "");
  const [packages, setPackages] = useState<PackageOption[]>([]);
  const [vouchers, setVouchers] = useState<VoucherRow[]>([]);
  const [batchFilter, setBatchFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const form = useForm<BulkVoucherValues>({
    resolver: zodResolver(bulkVoucherSchema),
    defaultValues: generatorDefaults,
  });

  const activePackages = useMemo(
    () => packages.filter((pkg) => pkg.isActive),
    [packages],
  );

  const loadSites = useCallback(async () => {
    const response = await fetch("/api/sites");
    const payload = await response.json();
    if (!response.ok) {
      toast.error(payload.error ?? "Failed to load sites");
      setLoading(false);
      return;
    }
    const nextSites = (payload.sites ?? []) as SiteOption[];
    setSites(nextSites);
    setSiteId((current) => current || initialSiteId || nextSites[0]?.id || "");
    setLoading(false);
  }, [initialSiteId]);

  const loadPackages = useCallback(async (id: string) => {
    if (!id) {
      setPackages([]);
      return;
    }
    const response = await fetch(`/api/sites/${id}/packages`);
    const payload = await response.json();
    if (!response.ok) return;
    setPackages(payload.packages ?? []);
  }, []);

  const loadVouchers = useCallback(async (id: string, batchId?: string | null) => {
    if (!id) {
      setVouchers([]);
      return;
    }
    const query = batchId ? `?batchId=${encodeURIComponent(batchId)}` : "";
    const response = await fetch(`/api/sites/${id}/vouchers${query}`);
    const payload = await response.json();
    if (!response.ok) {
      toast.error(payload.error ?? "Failed to load vouchers");
      return;
    }
    setVouchers(payload.vouchers ?? []);
  }, []);

  useEffect(() => {
    void loadSites();
  }, [loadSites]);

  useEffect(() => {
    if (!siteId) return;
    setBatchFilter(null);
    void loadPackages(siteId);
    void loadVouchers(siteId);
  }, [siteId, loadPackages, loadVouchers]);

  useEffect(() => {
    const firstActiveId = activePackages[0]?.id ?? "";
    form.setValue("packageId", firstActiveId, { shouldValidate: false });
  }, [activePackages, form]);

  async function onGenerate(values: BulkVoucherValues) {
    if (!siteId) {
      toast.error("Select a site first");
      return;
    }

    const parsed = bulkVoucherSchema.parse({
      ...values,
      codeLength: values.codeLength ?? 6,
    });

    const response = await fetch(`/api/sites/${siteId}/vouchers/bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      toast.error(payload.error ?? "Failed to generate vouchers");
      return;
    }

    toast.success(`Generated ${payload.count} unused cash vouchers`);
    setBatchFilter(payload.batchId);
    setVouchers(payload.vouchers as VoucherRow[]);
  }

  const printHref = siteId
    ? `/dashboard/vouchers/print?siteId=${encodeURIComponent(siteId)}${
        batchFilter ? `&batchId=${encodeURIComponent(batchFilter)}` : ""
      }`
    : "/dashboard/vouchers/print";

  return (
    <div className="space-y-6">
      <PageHeader
        className="print:hidden"
        eyebrow="Sales desk"
        title="Cash vouchers"
        description="Generate secure 6-character codes for counter sales, then print professional cut sheets."
        actions={
          <Link
            href={printHref}
            className={cn(
              buttonVariants({ variant: "outline" }),
              vouchers.length === 0 && "pointer-events-none opacity-50",
            )}
          >
            <Printer className="size-4" />
            Print layout
          </Link>
        }
      />

      <div className="lc-panel print:hidden rounded-2xl p-5">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700 ring-1 ring-teal-100">
            <Ticket className="size-4" />
          </div>
          <div>
            <h2 className="font-heading text-base font-semibold tracking-tight text-slate-900">
              Bulk generator
            </h2>
            <p className="text-sm text-slate-500">
              Codes save as unused stock until sold or redeemed at the portal.
            </p>
          </div>
        </div>
          <form
            className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
            onSubmit={form.handleSubmit(onGenerate)}
          >
            <div className="md:col-span-2 xl:col-span-1">
              <SitePicker sites={sites} value={siteId} onChange={setSiteId} />
            </div>

            <div className="grid gap-1.5">
              <Label>Package</Label>
              <Select
                value={form.watch("packageId")}
                onValueChange={(value) => {
                  if (value) form.setValue("packageId", value, { shouldValidate: true });
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select package" />
                </SelectTrigger>
                <SelectContent>
                  {activePackages.map((pkg) => (
                    <SelectItem key={pkg.id} value={pkg.id}>
                      {pkg.name} — {pkg.priceAmount}/= ·{" "}
                      {formatValidity(pkg.validityValue, pkg.validityUnit)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.packageId ? (
                <p className="text-xs text-destructive">
                  {form.formState.errors.packageId.message}
                </p>
              ) : null}
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                min={1}
                max={500}
                placeholder="50"
                {...form.register("quantity", { valueAsNumber: true })}
              />
              {form.formState.errors.quantity ? (
                <p className="text-xs text-destructive">
                  {form.formState.errors.quantity.message}
                </p>
              ) : null}
            </div>

            <div className="flex items-end">
              <Button
                type="submit"
                className="w-full bg-teal-700 text-white hover:bg-teal-800"
                disabled={
                  form.formState.isSubmitting ||
                  !siteId ||
                  activePackages.length === 0
                }
              >
                {form.formState.isSubmitting
                  ? "Generating…"
                  : "Generate vouchers"}
              </Button>
            </div>
          </form>
      </div>

      {batchFilter ? (
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <Badge variant="secondary">Latest batch {batchFilter.slice(0, 10)}…</Badge>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setBatchFilter(null);
              void loadVouchers(siteId);
            }}
          >
            Show all
          </Button>
          <Link
            href={printHref}
            className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
          >
            <Printer className="size-4" />
            Print this batch
          </Link>
        </div>
      ) : null}

      <div className="lc-panel rounded-2xl p-5 print:border-0 print:bg-transparent print:p-0 print:shadow-none">
        <div className="mb-4 print:hidden">
          <h2 className="font-heading text-base font-semibold tracking-tight text-slate-900">
            Voucher stock
          </h2>
          <p className="text-sm text-slate-500">
            {loading
              ? "Loading…"
              : `${vouchers.length} voucher${vouchers.length === 1 ? "" : "s"}`}
          </p>
        </div>
          {!siteId ? (
            <p className="text-sm text-slate-500">
              No sites found. Create a site before generating cash vouchers.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Package</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Validity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Shelf expiry</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vouchers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground">
                      No vouchers yet. Generate a batch of 50 (or any quantity) above.
                    </TableCell>
                  </TableRow>
                ) : (
                  vouchers.map((voucher) => (
                    <TableRow key={voucher.id}>
                      <TableCell className="font-mono font-semibold tracking-wide">
                        {voucher.code}
                      </TableCell>
                      <TableCell>{voucher.package.name}</TableCell>
                      <TableCell>
                        {voucher.package.priceAmount}/=
                      </TableCell>
                      <TableCell>
                        {formatValidity(
                          voucher.package.validityValue,
                          voucher.package.validityUnit,
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {statusLabel(voucher.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {voucher.expiresAt
                          ? new Date(voucher.expiresAt).toLocaleDateString()
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
      </div>
    </div>
  );
}
