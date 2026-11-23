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
import { siteFormSchema, type SiteFormValues } from "@/lib/sites";
import { VENUE_OPTIONS } from "@/lib/venue";

type SiteFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
};

const defaults: SiteFormValues = {
  name: "",
  location: "",
  routerModel: "",
  venueType: "OTHER",
};

export function SiteFormDialog({
  open,
  onOpenChange,
  onCreated,
}: SiteFormDialogProps) {
  const form = useForm<SiteFormValues>({
    resolver: zodResolver(siteFormSchema),
    defaultValues: defaults,
  });

  useEffect(() => {
    if (open) form.reset(defaults);
  }, [open, form]);

  async function onSubmit(values: SiteFormValues) {
    const response = await fetch("/api/sites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      toast.error(payload.error ?? "Failed to create site");
      return;
    }

    toast.success("Site created");
    onOpenChange(false);
    onCreated();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a new site</DialogTitle>
          <DialogDescription>
            Hotspot venue (guesthouse, café, daladala…). NAS ID and RADIUS secret
            are generated automatically.
          </DialogDescription>
        </DialogHeader>

        <form
          id="site-form"
          className="grid gap-4"
          onSubmit={form.handleSubmit(onSubmit)}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="site-name">Name</Label>
            <Input
              id="site-name"
              placeholder="Mwenge Lodge Wi‑Fi"
              {...form.register("name")}
            />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="venueType">Venue type</Label>
            <select
              id="venueType"
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
              {...form.register("venueType")}
            >
              {VENUE_OPTIONS.map((v) => (
                <option key={v.value} value={v.value}>
                  {v.label}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-500">
              {VENUE_OPTIONS.find((v) => v.value === form.watch("venueType"))?.blurb}
            </p>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="site-location">Location</Label>
            <Input
              id="site-location"
              placeholder="Dar es Salaam, Mwenge"
              {...form.register("location")}
            />
            {form.formState.errors.location && (
              <p className="text-xs text-destructive">
                {form.formState.errors.location.message}
              </p>
            )}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="site-router">Router model</Label>
            <Input
              id="site-router"
              placeholder="hAP ax2 / RB4011"
              {...form.register("routerModel")}
            />
            {form.formState.errors.routerModel && (
              <p className="text-xs text-destructive">
                {form.formState.errors.routerModel.message}
              </p>
            )}
          </div>
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="site-form"
            disabled={form.formState.isSubmitting}
            className="bg-teal-700 text-white hover:bg-teal-800"
          >
            {form.formState.isSubmitting ? "Saving…" : "Create site"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
