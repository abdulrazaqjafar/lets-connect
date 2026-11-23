"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { bulkVoucherSchema, type BulkVoucherValues } from "@/lib/vouchers";

export type PackageOption = {
  id: string;
  name: string;
  priceAmount: number;
  priceCurrency: string;
  isActive: boolean;
};

type BulkVoucherDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  siteId: string;
  packages: PackageOption[];
  onGenerated: (result: { batchId: string; count: number; vouchers: unknown[] }) => void;
};

const defaults: BulkVoucherValues = {
  packageId: "",
  quantity: 20,
  prefix: "",
  codeLength: 6,
  shelfLifeDays: 90,
  notes: "",
};

export function BulkVoucherDialog({
  open,
  onOpenChange,
  siteId,
  packages,
  onGenerated,
}: BulkVoucherDialogProps) {
  const activePackages = packages.filter((pkg) => pkg.isActive);

  const form = useForm<BulkVoucherValues>({
    resolver: zodResolver(bulkVoucherSchema),
    defaultValues: defaults,
  });

  useEffect(() => {
    if (!open) return;
    const firstActiveId = packages.find((pkg) => pkg.isActive)?.id ?? "";
    form.reset({
      ...defaults,
      packageId: firstActiveId,
    });
  }, [open, packages, form]);

  async function onSubmit(values: BulkVoucherValues) {
    const parsed = bulkVoucherSchema.parse(values);
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

    toast.success(`Generated ${payload.count} cash vouchers`);
    onOpenChange(false);
    onGenerated(payload);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Generate cash vouchers</DialogTitle>
          <DialogDescription>
            Create a printable batch of physical voucher codes for counter sales.
          </DialogDescription>
        </DialogHeader>

        <form
          id="bulk-voucher-form"
          className="grid gap-4"
          onSubmit={form.handleSubmit(onSubmit)}
        >
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
                    {pkg.name} — {pkg.priceAmount} {pkg.priceCurrency}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.packageId && (
              <p className="text-xs text-destructive">
                {form.formState.errors.packageId.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                min={1}
                max={500}
                {...form.register("quantity", { valueAsNumber: true })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="codeLength">Code length</Label>
              <Input
                id="codeLength"
                type="number"
                min={6}
                max={16}
                {...form.register("codeLength", { valueAsNumber: true })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="prefix">Prefix (optional)</Label>
              <Input
                id="prefix"
                placeholder="LC"
                {...form.register("prefix")}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="shelfLifeDays">Shelf life (days)</Label>
              <Input
                id="shelfLifeDays"
                type="number"
                min={1}
                max={365}
                {...form.register("shelfLifeDays", { valueAsNumber: true })}
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="notes">Batch notes</Label>
            <Textarea
              id="notes"
              placeholder="e.g. Counter pack — March print run"
              {...form.register("notes")}
            />
          </div>
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="bulk-voucher-form"
            disabled={form.formState.isSubmitting || activePackages.length === 0}
          >
            {form.formState.isSubmitting ? "Generating…" : "Generate batch"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
