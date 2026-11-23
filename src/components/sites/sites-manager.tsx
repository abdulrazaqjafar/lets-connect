"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, Eye, EyeOff, Plus, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { SiteBrandingDialog } from "@/components/sites/site-branding-dialog";
import { SiteFormDialog } from "@/components/sites/site-form-dialog";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { venueLabel } from "@/lib/venue";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type SiteRow = {
  id: string;
  name: string;
  location: string | null;
  routerModel: string | null;
  nasIdentifier: string;
  radiusSecret: string;
  status: string;
  brandName?: string | null;
  brandLogoUrl?: string | null;
  brandPrimaryColor?: string | null;
  brandDomain?: string | null;
  venueType?: string | null;
  paymentProvider?: string | null;
  routerHost?: string | null;
  portalRedirectStatus?: string | null;
  portalRedirectDetail?: string | null;
  _count: { packages: number; vouchers: number };
};

type QuotaInfo = {
  usedSites: number;
  maxSites: number;
  remaining: number;
  planName?: string;
};

function portalBadge(status?: string | null) {
  if (status === "OK") return { label: "Portal OK", className: "bg-emerald-100 text-emerald-800" };
  if (status === "BROKEN") return { label: "Portal broken", className: "bg-rose-100 text-rose-800" };
  return { label: "Portal unknown", className: "bg-slate-100 text-slate-600" };
}

export function SitesManager() {
  const [sites, setSites] = useState<SiteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [brandSite, setBrandSite] = useState<SiteRow | null>(null);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [quota, setQuota] = useState<QuotaInfo | null>(null);

  const loadSites = useCallback(async () => {
    setLoading(true);
    try {
      const [sitesRes, meRes] = await Promise.all([
        fetch("/api/sites"),
        fetch("/api/auth/me"),
      ]);
      const payload = await sitesRes.json();
      if (!sitesRes.ok) {
        toast.error(payload.error ?? "Failed to load sites");
        return;
      }
      setSites(payload.sites ?? []);

      if (meRes.ok) {
        const me = await meRes.json();
        setQuota({
          usedSites: me.quota?.usedSites ?? 0,
          maxSites: me.quota?.maxSites ?? 0,
          remaining: me.quota?.remaining ?? 0,
          planName: me.subscription?.plan?.name,
        });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSites();
  }, [loadSites]);

  async function copyText(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Could not copy");
    }
  }

  async function checkPortal(siteId: string) {
    setBusyId(siteId);
    try {
      const res = await fetch(`/api/sites/${siteId}/portal-health`);
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error ?? "Check failed");
      toast.success(payload.health?.detail ?? "Checked");
      await loadSites();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Check failed");
    } finally {
      setBusyId(null);
    }
  }

  async function repushPortal(siteId: string) {
    setBusyId(siteId);
    try {
      const res = await fetch(`/api/sites/${siteId}/portal-health`, { method: "POST" });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error ?? "Re-push failed");
      const health = payload.health;
      if (health?.status === "OK") toast.success(health.detail ?? "Portal healed");
      else toast.message(health?.detail ?? "Re-push finished with warnings");
      await loadSites();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Re-push failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Hotspot venues"
        title="Sites / Routers"
        description={
          quota
            ? `${quota.planName ?? "—"} · ${quota.usedSites}/${quota.maxSites} venues · portal auto-heal`
            : "Guesthouse, café, daladala — portal brand + redirect health."
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/router-setup"
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              Router assistant
            </Link>
            <Button
              className="bg-[#00338D] text-white hover:bg-[#00266b]"
              disabled={quota != null && quota.remaining <= 0}
              onClick={() => {
                if (quota && quota.remaining <= 0) {
                  toast.error("Site limit reached. Upgrade your subscription.");
                  return;
                }
                setDialogOpen(true);
              }}
            >
              <Plus className="size-4" />
              Add venue
            </Button>
          </div>
        }
      />

      <div className="lc-panel rounded-2xl p-5">
        <div className="mb-4">
          <h2 className="font-heading text-base font-semibold tracking-tight text-slate-900">
            Venues
          </h2>
          <p className="text-sm text-slate-500">
            {loading
              ? "Loading…"
              : `${sites.length} site${sites.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Venue</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Portal redirect</TableHead>
                <TableHead>NAS</TableHead>
                <TableHead>Secret</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {!loading && sites.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground">
                    No venues yet. Add a guesthouse, café, or bus hotspot.
                  </TableCell>
                </TableRow>
              ) : (
                sites.map((site) => {
                  const showSecret = revealed[site.id];
                  const portal = portalBadge(site.portalRedirectStatus);
                  return (
                    <TableRow key={site.id}>
                      <TableCell>
                        <p className="font-medium text-slate-900">{site.name}</p>
                        <p className="text-xs text-slate-500">
                          {site.brandDomain || site.location || "—"}
                        </p>
                      </TableCell>
                      <TableCell className="text-sm text-slate-600">
                        {venueLabel(site.venueType)}
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold",
                            portal.className,
                          )}
                          title={site.portalRedirectDetail ?? undefined}
                        >
                          {portal.label}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
                            {site.nasIdentifier}
                          </code>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            onClick={() =>
                              void copyText("NAS Identifier", site.nasIdentifier)
                            }
                          >
                            <Copy className="size-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <code className="max-w-[100px] truncate rounded bg-slate-100 px-1.5 py-0.5 text-xs">
                            {showSecret ? site.radiusSecret : "••••••••"}
                          </code>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            onClick={() =>
                              setRevealed((prev) => ({
                                ...prev,
                                [site.id]: !prev[site.id],
                              }))
                            }
                          >
                            {showSecret ? (
                              <EyeOff className="size-3.5" />
                            ) : (
                              <Eye className="size-3.5" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busyId === site.id}
                            onClick={() => void checkPortal(site.id)}
                          >
                            <ShieldCheck className="size-3.5" />
                            Check
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busyId === site.id}
                            onClick={() => void repushPortal(site.id)}
                          >
                            <RefreshCw
                              className={cn(
                                "size-3.5",
                                busyId === site.id && "animate-spin",
                              )}
                            />
                            Re-push
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setBrandSite(site)}
                          >
                            Brand
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <SiteFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={() => void loadSites()}
      />
      <SiteBrandingDialog
        open={Boolean(brandSite)}
        onOpenChange={(open) => {
          if (!open) setBrandSite(null);
        }}
        site={brandSite}
        onSaved={() => void loadSites()}
      />
    </div>
  );
}
