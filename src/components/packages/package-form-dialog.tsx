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
import {
  formatSpeedMikrotik,
  packageFormSchema,
  type PackageFormValues,
} from "@/lib/packages";

export type PackageRecord = {
  id: string;
  siteId: string;
  name: string;
  description: string | null;
  priceAmount: number;
  priceCurrency: string;
  validityValue: number;
  validityUnit: "HOURS" | "DAYS";
  downloadLimitKbps: number | null;
  uploadLimitKbps: number | null;
  dataLimitMb: number | null;
  maxDevices: number;
  isActive: boolean;
};

export type SiteOption = {
  id: string;
  name: string;
};

type PackageFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sites: SiteOption[];
  defaultSiteId?: string;
  packageToEdit?: PackageRecord | null;
  onSaved: () => void;
};

const defaults: PackageFormValues = {
  siteId: "",
  name: "",
  description: "",
  priceAmount: 1000,
  priceCurrency: "TZS",
  durationHours: 24,
  uploadSpeed: "2M",
  downloadSpeed: "5M",
  dataLimitMb: null,
  maxDevices: 1,
  isActive: true,
};

export function PackageFormDialog({
  open,
  onOpenChange,
  sites,
  defaultSiteId,
  packageToEdit,
  onSaved,
}: PackageFormDialogProps) {
  const form = useForm<PackageFormValues>({
    resolver: zodResolver(packageFormSchema),
    defaultValues: defaults,
  });

  useEffect(() => {
    if (!open) return;

    if (packageToEdit) {
      form.reset({
        siteId: packageToEdit.siteId,
        name: packageToEdit.name,
        description: packageToEdit.description ?? "",
        priceAmount: packageToEdit.priceAmount,
        priceCurrency: packageToEdit.priceCurrency || "TZS",
        durationHours:
          packageToEdit.validityUnit === "DAYS"
            ? packageToEdit.validityValue * 24
            : packageToEdit.validityValue,
        uploadSpeed: formatSpeedMikrotik(packageToEdit.uploadLimitKbps) || "2M",
        downloadSpeed:
          formatSpeedMikrotik(packageToEdit.downloadLimitKbps) || "5M",
        dataLimitMb: packageToEdit.dataLimitMb,
        maxDevices: packageToEdit.maxDevices,
        isActive: packageToEdit.isActive,
      });
    } else {
      form.reset({
        ...defaults,
        siteId: defaultSiteId || sites[0]?.id || "",
      });
    }
  }, [open, packageToEdit, defaultSiteId, sites, form]);

  async function onSubmit(values: PackageFormValues) {
    const parsed = packageFormSchema.parse(values);
    const isEdit = Boolean(packageToEdit);
    const url = isEdit
      ? `/api/packages/${packageToEdit!.id}`
      : "/api/packages";

    const response = await fetch(url, {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      toast.error(payload.error ?? "Failed to save package");
      return;
    }

    toast.success(isEdit ? "Package updated" : "Package created");
    onOpenChange(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {packageToEdit ? "Edit package" : "New hotspot package"}
          </DialogTitle>
          <DialogDescription>
            Price in TZS, duration in hours, speeds like 2M / 5M.
          </DialogDescription>
        </DialogHeader>

        <form
          id="package-form"
          className="grid gap-4"
          onSubmit={form.handleSubmit(onSubmit)}
        >
          <div className="grid gap-1.5">
            <Label>Site</Label>
            <Select
              value={form.watch("siteId")}
              onValueChange={(value) => {
                if (value) form.setValue("siteId", value, { shouldValidate: true });
              }}
              disabled={Boolean(packageToEdit)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select site" />
              </SelectTrigger>
              <SelectContent>
                {sites.map((site) => (
                  <SelectItem key={site.id} value={site.id}>
                    {site.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.siteId && (
              <p className="text-xs text-destructive">
                {form.formState.errors.siteId.message}
              </p>
            )}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="pkg-name">Name</Label>
            <Input
              id="pkg-name"
              placeholder="Daily Unlimited"
              {...form.register("name")}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="pkg-price">Price (TZS)</Label>
              <Input
                id="pkg-price"
                type="number"
                min={0}
                step={100}
                {...form.register("priceAmount", { valueAsNumber: true })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pkg-hours">Duration (hours)</Label>
              <Input
                id="pkg-hours"
                type="number"
                min={1}
                {...form.register("durationHours", { valueAsNumber: true })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="pkg-up">Upload speed</Label>
              <Input
                id="pkg-up"
                placeholder="2M"
                {...form.register("uploadSpeed")}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pkg-down">Download speed</Label>
              <Input
                id="pkg-down"
                placeholder="5M"
                {...form.register("downloadSpeed")}
              />
            </div>
          </div>
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="package-form"
            disabled={form.formState.isSubmitting || sites.length === 0}
            className="bg-teal-700 text-white hover:bg-teal-800"
          >
            {form.formState.isSubmitting ? "Saving…" : "Save package"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
