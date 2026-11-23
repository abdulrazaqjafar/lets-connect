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
import { cn } from "@/lib/utils";

type SiteOption = {
  id: string;
  name: string;
  nasIdentifier: string;
  radiusSecret: string;
};

export default function RouterSetupPage() {
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [siteId, setSiteId] = useState("");
  const [copied, setCopied] = useState<"one" | "full" | "device" | null>(null);
  const [loadingSites, setLoadingSites] = useState(true);
  const [loadingScript, setLoadingScript] = useState(false);
  const [script, setScript] = useState("");
  const [oneLine, setOneLine] = useState("");
  const [deviceModeCmd, setDeviceModeCmd] = useState<string | null>(null);
  const [portalUrl, setPortalUrl] = useState("");
  const [rscUrl, setRscUrl] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [radiusHost, setRadiusHost] = useState("18.199.177.29");
  const [lanInterface, setLanInterface] = useState("bridge-hotspot");
  const [wanInterface, setWanInterface] = useState("ether1");
  const [rosVersion, setRosVersion] = useState<"6" | "7">("7");
  const [hotspot, setHotspot] = useState(true);
  const [pppoe, setPppoe] = useState(false);
  const [staticIp, setStaticIp] = useState(false);

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

  const loadInstall = useCallback(async () => {
    if (!siteId) {
      setScript("");
      setOneLine("");
      setWarnings([]);
      return;
    }
    setLoadingScript(true);
    try {
      const params = new URLSearchParams({
        radiusHost: radiusHost.trim(),
        lanInterface: lanInterface.trim(),
        wanInterface: wanInterface.trim(),
        ros: rosVersion,
        hotspot: hotspot ? "1" : "0",
        pppoe: pppoe ? "1" : "0",
        static: staticIp ? "1" : "0",
      });

      const [scriptRes, installRes] = await Promise.all([
        fetch(`/api/sites/${siteId}/mikrotik-script?${params.toString()}`),
        fetch(`/api/sites/${siteId}/install-command?${params.toString()}`),
      ]);
      const scriptPayload = await scriptRes.json().catch(() => ({}));
      const installPayload = await installRes.json().catch(() => ({}));

      if (!scriptRes.ok) {
        toast.error(scriptPayload.error ?? "Failed to generate script");
        setScript("");
      } else {
        setScript(scriptPayload.script ?? "");
        setWarnings((scriptPayload.warnings ?? []) as string[]);
      }

      if (installRes.ok) {
        setOneLine(installPayload.oneLineCommand ?? "");
        setDeviceModeCmd(installPayload.deviceModeCommand ?? null);
        setPortalUrl(installPayload.portalUrl ?? "");
        setRscUrl(installPayload.rscUrl ?? "");
      }
    } finally {
      setLoadingScript(false);
    }
  }, [
    siteId,
    radiusHost,
    lanInterface,
    wanInterface,
    rosVersion,
    hotspot,
    pppoe,
    staticIp,
  ]);

  useEffect(() => {
    void loadSites();
  }, [loadSites]);

  useEffect(() => {
    void loadInstall();
  }, [loadInstall]);

  const selected = sites.find((site) => site.id === siteId) ?? null;

  async function copyText(
    label: "one" | "full" | "device",
    value: string,
    okMessage: string,
  ) {
    if (!value) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        throw new Error("clipboard unavailable");
      }
      setCopied(label);
      toast.success(okMessage);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      try {
        const area = document.createElement("textarea");
        area.value = value;
        area.style.position = "fixed";
        area.style.left = "-9999px";
        document.body.appendChild(area);
        area.focus();
        area.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(area);
        if (!ok) throw new Error("execCommand failed");
        setCopied(label);
        toast.success(okMessage);
        window.setTimeout(() => setCopied(null), 2000);
      } catch {
        toast.error("Copy blocked — use Download .rsc instead");
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
        eyebrow="Routers"
        title="Add / configure router"
        description="One-line Winbox install: NTP sync, fetch site .rsc, import — Hotspot portal redirect included."
      />

      <div className="lc-panel space-y-5 rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-orange-50 text-[#F78E1E] ring-1 ring-orange-100">
            <Terminal className="size-4" />
          </div>
          <div>
            <h2 className="font-heading text-base font-semibold tracking-tight text-slate-900">
              MikroTik router
            </h2>
            <p className="text-sm text-slate-500">
              Pick site, services, and RouterOS version — then paste the install command.
            </p>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <div className="grid gap-1.5">
            <Label>Router / site</Label>
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
            <Label>RouterOS version</Label>
            <div className="flex gap-2">
              {(["7", "6"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setRosVersion(v)}
                  className={cn(
                    "flex-1 rounded-xl border px-3 py-2.5 text-sm font-semibold transition",
                    rosVersion === v
                      ? "border-[#00338D] bg-[#00338D] text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
                  )}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <Label className="mb-2 block">Services</Label>
          <div className="flex flex-wrap gap-3">
            {(
              [
                { key: "hotspot", label: "Hotspot", value: hotspot, set: setHotspot },
                { key: "pppoe", label: "PPPoE", value: pppoe, set: setPppoe },
                {
                  key: "static",
                  label: "Static IP",
                  value: staticIp,
                  set: setStaticIp,
                },
              ] as const
            ).map((svc) => (
              <label
                key={svc.key}
                className={cn(
                  "inline-flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm",
                  svc.value
                    ? "border-orange-300 bg-orange-50 text-slate-900"
                    : "border-slate-200 bg-white text-slate-600",
                )}
              >
                <input
                  type="checkbox"
                  className="size-4 accent-[#F78E1E]"
                  checked={svc.value}
                  onChange={(e) => svc.set(e.target.checked)}
                />
                {svc.label}
              </label>
            ))}
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          <div className="grid gap-1.5">
            <Label htmlFor="radiusHost">Cloud RADIUS IP</Label>
            <Input
              id="radiusHost"
              className="bg-white"
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
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="wanInterface">WAN (NAT)</Label>
            <Input
              id="wanInterface"
              className="bg-white"
              value={wanInterface}
              onChange={(e) => setWanInterface(e.target.value)}
            />
          </div>
        </div>

        {deviceModeCmd ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <p className="font-semibold">Advisory</p>
            <p className="mt-1 text-amber-900/80">
              If RouterOS 7 blocks setup with a device-mode message, run this first:
            </p>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-950 px-3 py-2 font-mono text-[11px] text-amber-100">
              {deviceModeCmd}
            </pre>
            <Button
              size="sm"
              variant="outline"
              className="mt-2"
              onClick={() =>
                void copyText("device", deviceModeCmd, "Device-mode command copied")
              }
            >
              {copied === "device" ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              Copy
            </Button>
          </div>
        ) : null}

        <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3">
          <p className="text-sm font-semibold text-slate-900">
            Run in Winbox → New Terminal
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Syncs time, downloads this site&apos;s .rsc from Lets Connect, imports it
            (includes voucher portal redirect).
          </p>
          <pre className="mt-3 max-h-28 overflow-auto rounded-lg bg-slate-950 px-3 py-2 font-mono text-[10px] leading-relaxed break-all whitespace-pre-wrap text-teal-100">
            {loadingScript ? "Generating…" : oneLine || "Select a site…"}
          </pre>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              className="bg-[#00338D] text-white hover:bg-[#00266b]"
              disabled={!oneLine}
              onClick={() =>
                void copyText("one", oneLine, "Install command copied — paste in Terminal")
              }
            >
              {copied === "one" ? <Check className="size-4" /> : <Copy className="size-4" />}
              Copy install command
            </Button>
            <Button variant="outline" disabled={!script} onClick={downloadScript}>
              <Download className="size-4" />
              Download .rsc
            </Button>
            <Button
              variant="outline"
              disabled={!siteId || loadingScript}
              onClick={() => void loadInstall()}
            >
              Refresh
            </Button>
          </div>
          {portalUrl ? (
            <p className="mt-3 text-xs text-slate-500">
              Phone Sign-in opens{" "}
              <code className="rounded bg-white px-1 py-0.5 text-[11px]">{portalUrl}</code>
            </p>
          ) : null}
          {rscUrl ? (
            <p className="mt-1 truncate text-[10px] text-slate-400">
              .rsc URL: {rscUrl}
            </p>
          ) : null}
        </div>

        {selected ? (
          <div className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700 sm:grid-cols-3">
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
        ) : null}

        {warnings.length > 0 ? (
          <ul className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            {warnings.map((warning) => (
              <li key={warning}>• {warning}</li>
            ))}
          </ul>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-slate-700">Full script preview</p>
          <Button
            size="sm"
            variant="outline"
            disabled={!script}
            onClick={() => void copyText("full", script, "Full script copied")}
          >
            {copied === "full" ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            Copy full script
          </Button>
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
