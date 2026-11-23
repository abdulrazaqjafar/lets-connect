"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type SiteBrandingDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  site: {
    id: string;
    name: string;
    brandName?: string | null;
    brandLogoUrl?: string | null;
    brandPrimaryColor?: string | null;
    paymentProvider?: string | null;
    routerHost?: string | null;
  } | null;
  onSaved: () => void;
};

export function SiteBrandingDialog({
  open,
  onOpenChange,
  site,
  onSaved,
}: SiteBrandingDialogProps) {
  const [brandName, setBrandName] = useState("");
  const [brandLogoUrl, setBrandLogoUrl] = useState("");
  const [brandPrimaryColor, setBrandPrimaryColor] = useState("#0d9488");
  const [paymentProvider, setPaymentProvider] = useState("SNIPPE");
  const [routerHost, setRouterHost] = useState("");
  const [routerUsername, setRouterUsername] = useState("letsconnect");
  const [routerPassword, setRouterPassword] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!site) return;
    setBrandName(site.brandName ?? site.name);
    setBrandLogoUrl(site.brandLogoUrl ?? "");
    setBrandPrimaryColor(site.brandPrimaryColor ?? "#F78E1E");
    setPaymentProvider(site.paymentProvider ?? "SNIPPE");
    setRouterHost(site.routerHost ?? "");
  }, [site]);

  async function save() {
    if (!site) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/sites/${site.id}/branding`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandName: brandName || null,
          brandLogoUrl: brandLogoUrl || null,
          brandPrimaryColor,
          paymentProvider,
          routerHost: routerHost || null,
          routerUsername: routerUsername || null,
          ...(routerPassword ? { routerPassword } : {}),
        }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error ?? "Save failed");
      toast.success("Site branding & router API saved");
      onSaved();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Portal branding & API</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label htmlFor="brandName">Brand name</Label>
            <Input
              id="brandName"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="logo">Logo URL</Label>
            <Input
              id="logo"
              value={brandLogoUrl}
              onChange={(e) => setBrandLogoUrl(e.target.value)}
              placeholder="https://…"
            />
          </div>
          <div>
            <Label htmlFor="color">Primary color</Label>
            <Input
              id="color"
              type="color"
              value={brandPrimaryColor}
              onChange={(e) => setBrandPrimaryColor(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="pay">Payment gateway</Label>
            <select
              id="pay"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
              value={paymentProvider}
              onChange={(e) => setPaymentProvider(e.target.value)}
            >
              <option value="SNIPPE">Snippe</option>
              <option value="SELCOM">Selcom</option>
              <option value="CLICKPESA">ClickPesa</option>
              <option value="AZAMPAY">AzamPay</option>
            </select>
          </div>
          <div>
            <Label htmlFor="host">Router API host (health / control)</Label>
            <Input
              id="host"
              value={routerHost}
              onChange={(e) => setRouterHost(e.target.value)}
              placeholder="10.0.0.1 or WireGuard IP"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="apiUser">API user</Label>
              <Input
                id="apiUser"
                value={routerUsername}
                onChange={(e) => setRouterUsername(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="apiPass">API password</Label>
              <Input
                id="apiPass"
                type="password"
                value={routerPassword}
                onChange={(e) => setRouterPassword(e.target.value)}
                placeholder="Leave blank to keep"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="bg-teal-700 text-white hover:bg-teal-800"
            disabled={saving}
            onClick={() => void save()}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
