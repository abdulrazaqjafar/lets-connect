"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/dashboard/page-header";
import {
  PackageFormDialog,
  type PackageRecord,
  type SiteOption,
} from "@/components/packages/package-form-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { formatSpeed, formatValidity } from "@/lib/packages";

type PackageRow = PackageRecord & {
  site?: { id: string; name: string };
  _count: { vouchers: number };
};

export function PackagesManager() {
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [siteId, setSiteId] = useState<string>("all");
  const [packages, setPackages] = useState<PackageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PackageRecord | null>(null);

  const loadSites = useCallback(async () => {
    const response = await fetch("/api/sites");
    const payload = await response.json();
    if (!response.ok) {
      toast.error(payload.error ?? "Failed to load sites");
      return;
    }
    setSites(
      ((payload.sites ?? []) as Array<{ id: string; name: string }>).map(
        (site) => ({ id: site.id, name: site.name }),
      ),
    );
  }, []);

  const loadPackages = useCallback(async () => {
    setLoading(true);
    try {
      const query =
        siteId && siteId !== "all" ? `?siteId=${encodeURIComponent(siteId)}` : "";
      const response = await fetch(`/api/packages${query}`);
      const payload = await response.json();
      if (!response.ok) {
        toast.error(payload.error ?? "Failed to load packages");
        return;
      }
      setPackages(payload.packages ?? []);
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  useEffect(() => {
    void loadSites();
  }, [loadSites]);

  useEffect(() => {
    void loadPackages();
  }, [loadPackages]);

  async function handleDelete(pkg: PackageRow) {
    const confirmed = window.confirm(
      pkg._count.vouchers > 0
        ? "This package has vouchers and will be deactivated. Continue?"
        : `Delete package “${pkg.name}”?`,
    );
    if (!confirmed) return;

    const response = await fetch(`/api/packages/${pkg.id}`, { method: "DELETE" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      toast.error(payload.error ?? "Failed to delete package");
      return;
    }

    toast.success(payload.deactivated ? "Package deactivated" : "Package deleted");
    void loadPackages();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Catalog"
        title="Packages"
        description="Hotspot plans priced in TZS with duration and MikroTik speed limits."
        actions={
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Select value={siteId} onValueChange={(value) => value && setSiteId(value)}>
              <SelectTrigger className="w-full min-w-[200px] bg-white sm:w-56">
                <SelectValue placeholder="Filter by site" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sites</SelectItem>
                {sites.map((site) => (
                  <SelectItem key={site.id} value={site.id}>
                    {site.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              className="bg-teal-700 text-white hover:bg-teal-800"
              disabled={sites.length === 0}
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="size-4" />
              New package
            </Button>
          </div>
        }
      />

      <div className="lc-panel rounded-2xl p-5">
        <div className="mb-4">
          <h2 className="font-heading text-base font-semibold tracking-tight text-slate-900">
            Hotspot packages
          </h2>
          <p className="text-sm text-slate-500">
            {loading
              ? "Loading…"
              : `${packages.length} package${packages.length === 1 ? "" : "s"}`}
          </p>
        </div>
          {sites.length === 0 ? (
            <p className="text-sm text-slate-500">
              Create a site first under Sites before adding packages.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Site</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Upload</TableHead>
                  <TableHead>Download</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {packages.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-muted-foreground">
                      No packages yet. Create one linked to a site.
                    </TableCell>
                  </TableRow>
                ) : (
                  packages.map((pkg) => (
                    <TableRow key={pkg.id}>
                      <TableCell className="font-medium">{pkg.name}</TableCell>
                      <TableCell>{pkg.site?.name ?? "—"}</TableCell>
                      <TableCell>
                        {pkg.priceAmount.toLocaleString()} {pkg.priceCurrency}
                      </TableCell>
                      <TableCell>
                        {formatValidity(pkg.validityValue, pkg.validityUnit)}
                      </TableCell>
                      <TableCell>{formatSpeed(pkg.uploadLimitKbps)}</TableCell>
                      <TableCell>{formatSpeed(pkg.downloadLimitKbps)}</TableCell>
                      <TableCell>
                        <Badge variant={pkg.isActive ? "default" : "secondary"}>
                          {pkg.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            onClick={() => {
                              setEditing(pkg);
                              setDialogOpen(true);
                            }}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            onClick={() => void handleDelete(pkg)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
      </div>

      <PackageFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        sites={sites}
        defaultSiteId={siteId !== "all" ? siteId : sites[0]?.id}
        packageToEdit={editing}
        onSaved={() => void loadPackages()}
      />
    </div>
  );
}
