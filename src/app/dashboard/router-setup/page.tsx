"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Download, Terminal } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/dashboard/page-header";
import { ScriptTerminal } from "@/components/router-setup/script-terminal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type SiteOption = {
  id: string;
  name: string;
  nasIdentifier: string;
  radiusSecret: string;
};

export default function RouterSetupPage() {
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [siteId, setSiteId] = useState("");
  const [copied, setCopied] = useState(false);
  const [loadingSites, setLoadingSites] = useState(true);
  const [loadingScript, setLoadingScript] = useState(false);
  const [script, setScript] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [radiusHost, setRadiusHost] = useState("18.199.177.29");
  const [lanInterface, setLanInterface] = useState("bridge-hotspot");
  const [wanInterface, setWanInterface] = useState("ether1");

  const loadSites = useCallback(async () => {
    setLoadingSites(true);
    try {
      const response = await fetch("/api/sites");
      const payload = await response.json();
      if (!response.ok) {
        toast.error(payload.error ?? "Failed to load sites");
        return;
      }
      const next = (payload.sites ?? []) as SiteOption[];
      setSites(next);
      setSiteId((current) => current || next[0]?.id || "");
    } finally {
      setLoadingSites(false);
    }
  }, []);

  const loadScript = useCallback(async () => {
    if (!siteId) {
      setScript("");
      setWarnings([]);
      return;
    }
    setLoadingScript(true);
    try {
      const params = new URLSearchParams();
      if (radiusHost.trim()) params.set("radiusHost", radiusHost.trim());
      if (lanInterface.trim()) params.set("lanInterface", lanInterface.trim());
      if (wanInterface.trim()) params.set("wanInterface", wanInterface.trim());

      const response = await fetch(
        `/api/sites/${siteId}/mikrotik-script?${params.toString()}`,
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error(payload.error ?? "Failed to generate script");
        setScript("");
        return;
      }
      setScript(payload.script ?? "");
      setWarnings((payload.warnings ?? []) as string[]);
    } finally {
      setLoadingScript(false);
    }
  }, [siteId, radiusHost, lanInterface, wanInterface]);

  useEffect(() => {
    void loadSites();
  }, [loadSites]);

  useEffect(() => {
    void loadScript();
  }, [loadScript]);

  const selected = sites.find((site) => site.id === siteId) ?? null;

  async function copyCommands() {
    if (!script) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(script);
      } else {
        throw new Error("clipboard unavailable");
      }
      setCopied(true);
      toast.success("Commands copied — paste into Winbox Terminal");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // HTTP (non-secure) pages often block clipboard — fallback select
      try {
        const area = document.createElement("textarea");
        area.value = script;
        area.style.position = "fixed";
        area.style.left = "-9999px";
        document.body.appendChild(area);
        area.focus();
        area.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(area);
        if (!ok) throw new Error("execCommand failed");
        setCopied(true);
        toast.success("Commands copied — paste into Winbox Terminal");
        window.setTimeout(() => setCopied(false), 2000);
      } catch {
        toast.error(
          "Copy blocked on HTTP. Use Download .rsc instead, then import in Winbox.",
        );
      }
    }
  }

  function downloadScript() {
    if (!script || !selected) return;
    const blob = new Blob([script], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `lets-connect-${selected.nasIdentifier}.rsc`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Provisioning"
        title="Router setup"
        description={
          <>
            Hotspot + RADIUS + redirect to voucher portal at{" "}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
              http://18.199.177.29/portal/…
            </code>
          </>
        }
      />

      <div className="lc-panel space-y-4 rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700 ring-1 ring-teal-100">
            <Terminal className="size-4" />
          </div>
          <div>
            <h2 className="font-heading text-base font-semibold tracking-tight text-slate-900">
              RouterOS script generator
            </h2>
            <p className="text-sm text-slate-500">
              Creates bridge, DHCP, NAT, RADIUS (PoD 3799), Hotspot profile, and
              Walled Garden. Compatible with RouterOS 6.49+ / 7.x.
            </p>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <div className="grid gap-1.5">
            <Label>Site</Label>
            <Select
              value={siteId}
              onValueChange={(value) => value && setSiteId(value)}
              disabled={loadingSites || sites.length === 0}
            >
              <SelectTrigger className="w-full bg-white">
                <SelectValue
                  placeholder={
                    loadingSites ? "Loading sites…" : "Select a registered site"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {sites.map((site) => (
                  <SelectItem key={site.id} value={site.id}>
                    {site.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="radiusHost">Cloud RADIUS IP / host</Label>
            <Input
              id="radiusHost"
              className="bg-white"
              placeholder="18.199.177.29"
              value={radiusHost}
              onChange={(e) => setRadiusHost(e.target.value)}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="lanInterface">Hotspot LAN / bridge</Label>
            <Input
              id="lanInterface"
              className="bg-white"
              value={lanInterface}
              onChange={(e) => setLanInterface(e.target.value)}
              placeholder="bridge-hotspot"
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="wanInterface">WAN interface (NAT)</Label>
            <Input
              id="wanInterface"
              className="bg-white"
              value={wanInterface}
              onChange={(e) => setWanInterface(e.target.value)}
              placeholder="ether1"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            className="bg-teal-700 text-white hover:bg-teal-800"
            disabled={!script || loadingScript}
            onClick={() => void copyCommands()}
          >
            {copied ? (
              <>
                <Check className="size-4" />
                Copied
              </>
            ) : (
              <>
                <Copy className="size-4" />
                Copy Terminal Commands
              </>
            )}
          </Button>
          <Button variant="outline" disabled={!script} onClick={downloadScript}>
            <Download className="size-4" />
            Download .rsc
          </Button>
          <Button
            variant="outline"
            disabled={!siteId || loadingScript}
            onClick={() => void loadScript()}
          >
            {loadingScript ? "Generating…" : "Refresh script"}
          </Button>
        </div>

        {selected ? (
          <div className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-sm text-slate-700 sm:grid-cols-3">
            <p>
              <span className="font-medium text-slate-900">Site</span>
              <br />
              {selected.name}
            </p>
            <p>
              <span className="font-medium text-slate-900">NAS Identifier</span>
              <br />
              <code className="text-xs">{selected.nasIdentifier}</code>
            </p>
            <p>
              <span className="font-medium text-slate-900">RADIUS secret</span>
              <br />
              <code className="break-all text-xs">{selected.radiusSecret}</code>
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {loadingSites
              ? "Loading your sites…"
              : "No sites found. Create one under Sites first."}
          </p>
        )}

        {warnings.length > 0 ? (
          <ul className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            {warnings.map((warning) => (
              <li key={warning}>• {warning}</li>
            ))}
          </ul>
        ) : null}

        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          <p className="font-medium text-slate-900">How to apply in Winbox</p>
          <ol className="mt-1 list-decimal space-y-1 pl-5">
            <li>Keep Cloud RADIUS IP as <code>18.199.177.29</code>.</li>
            <li>
              Prefer <strong>Download .rsc</strong> on HTTP (Copy may be blocked by the
              browser), then Winbox → Files → Upload → Import.
            </li>
            <li>Or Copy → Winbox → New Terminal → paste.</li>
            <li>
              Phone connects to SSID <code>LetsConnect</code> → browser opens voucher
              portal automatically.
            </li>
          </ol>
        </div>

        <ScriptTerminal
          script={script}
          emptyMessage={
            loadingScript
              ? "Generating RouterOS commands…"
              : "Select a site to generate RouterOS commands."
          }
        />
      </div>
    </div>
  );
}
