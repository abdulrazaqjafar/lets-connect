"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, Eye, EyeOff, Plus } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { SiteBrandingDialog } from "@/components/sites/site-branding-dialog";
import { SiteFormDialog } from "@/components/sites/site-form-dialog";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
  paymentProvider?: string | null;
  routerHost?: string | null;
  _count: { packages: number; vouchers: number };
};

type QuotaInfo = {
  usedSites: number;
  maxSites: number;
  remaining: number;
  planName?: string;
};

export function SitesManager() {
  const [sites, setSites] = useState<SiteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [brandSite, setBrandSite] = useState<SiteRow | null>(null);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
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

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Network"
        title="Sites"
        description={
          quota
            ? `${quota.planName ?? "—"} plan · ${quota.usedSites}/${quota.maxSites} sites used.`
            : "Manage Wi‑Fi locations, NAS identifiers, and RADIUS secrets."
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/billing"
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              Subscriptions
            </Link>
            <Button
              className="bg-teal-700 text-white hover:bg-teal-800"
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
              Add site
            </Button>
          </div>
        }
      />

      <div className="lc-panel rounded-2xl p-5">
        <div className="mb-4">
          <h2 className="font-heading text-base font-semibold tracking-tight text-slate-900">
            All locations
          </h2>
          <p className="text-sm text-slate-500">
            {loading
              ? "Loading…"
              : `${sites.length} site${sites.length === 1 ? "" : "s"}`}
          </p>
        </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Router</TableHead>
                <TableHead>NAS Identifier</TableHead>
                <TableHead>Secret Key</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {!loading && sites.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-muted-foreground">
                    No sites yet. Add your first hotspot location.
                  </TableCell>
                </TableRow>
              ) : (
                sites.map((site) => {
                  const showSecret = revealed[site.id];
                  return (
                    <TableRow key={site.id}>
                      <TableCell className="font-medium">{site.name}</TableCell>
                      <TableCell>{site.location ?? "—"}</TableCell>
                      <TableCell>{site.routerModel ?? "—"}</TableCell>
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
                          <code className="max-w-[140px] truncate rounded bg-slate-100 px-1.5 py-0.5 text-xs">
                            {showSecret ? site.radiusSecret : "••••••••••••"}
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
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            onClick={() =>
                              void copyText("Secret Key", site.radiusSecret)
                            }
                          >
                            <Copy className="size-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{site.status}</Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setBrandSite(site)}
                        >
                          Brand / API
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
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
