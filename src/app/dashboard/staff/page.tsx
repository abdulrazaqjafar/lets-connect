"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type SiteOpt = { id: string; name: string };
type StaffRow = {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  sites: SiteOpt[];
};

export default function StaffPage() {
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [sites, setSites] = useState<SiteOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    siteIds: [] as string[],
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [staffRes, sitesRes] = await Promise.all([
        fetch("/api/staff"),
        fetch("/api/sites"),
      ]);
      const staffPayload = await staffRes.json().catch(() => ({}));
      const sitesPayload = await sitesRes.json().catch(() => ({}));
      if (!staffRes.ok) {
        toast.error(staffPayload.error ?? "Failed to load staff");
        return;
      }
      setStaff(staffPayload.staff ?? []);
      setSites(
        (sitesPayload.sites ?? []).map((s: { id: string; name: string }) => ({
          id: s.id,
          name: s.name,
        })),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function toggleSite(id: string) {
    setForm((f) => ({
      ...f,
      siteIds: f.siteIds.includes(id)
        ? f.siteIds.filter((x) => x !== id)
        : [...f.siteIds, id],
    }));
  }

  async function createStaff(e: React.FormEvent) {
    e.preventDefault();
    if (form.siteIds.length === 0) {
      toast.error("Assign at least one site");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error(payload.error ?? "Could not create staff");
        return;
      }
      toast.success("Cashier created — they can log in and print cash vouchers");
      setForm({ name: "", email: "", phone: "", password: "", siteIds: [] });
      void load();
    } finally {
      setBusy(false);
    }
  }

  async function removeStaff(id: string) {
    if (!confirm("Remove this cashier?")) return;
    const response = await fetch(`/api/staff/${id}`, { method: "DELETE" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      toast.error(payload.error ?? "Could not remove");
      return;
    }
    toast.success("Removed");
    void load();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Team"
        title="Cashier / Staff"
        description="Staff can only create and print cash vouchers for assigned sites. Online buyers still pay on the Wi‑Fi portal."
      />

      <form
        onSubmit={(e) => void createStaff(e)}
        className="lc-panel grid max-w-xl gap-3 rounded-2xl p-5"
      >
        <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <UserPlus className="size-4 text-teal-700" />
          Add cashier
        </p>
        <div className="grid gap-1.5">
          <Label>Name</Label>
          <Input
            className="bg-white"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
        </div>
        <div className="grid gap-1.5">
          <Label>Email (login)</Label>
          <Input
            type="email"
            className="bg-white"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
        </div>
        <div className="grid gap-1.5">
          <Label>Phone (optional)</Label>
          <Input
            className="bg-white"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </div>
        <div className="grid gap-1.5">
          <Label>Password</Label>
          <Input
            type="password"
            className="bg-white"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
            minLength={8}
          />
        </div>
        <div className="grid gap-2">
          <Label>Assigned sites</Label>
          {sites.length === 0 ? (
            <p className="text-sm text-slate-500">Create a site first.</p>
          ) : (
            sites.map((site) => (
              <label
                key={site.id}
                className="flex items-center gap-2 text-sm text-slate-700"
              >
                <input
                  type="checkbox"
                  checked={form.siteIds.includes(site.id)}
                  onChange={() => toggleSite(site.id)}
                />
                {site.name}
              </label>
            ))
          )}
        </div>
        <Button
          type="submit"
          className="bg-teal-700 text-white hover:bg-teal-800"
          disabled={busy}
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : null}
          Create cashier
        </Button>
      </form>

      <div className="lc-panel overflow-hidden rounded-2xl">
        <div className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900">
          Team members
        </div>
        {loading ? (
          <p className="p-4 text-sm text-slate-500">Loading…</p>
        ) : staff.length === 0 ? (
          <p className="p-4 text-sm text-slate-500">No cashiers yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {staff.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-medium text-slate-900">
                    {row.name ?? row.email}
                  </p>
                  <p className="text-slate-500">{row.email}</p>
                  <p className="text-xs text-slate-400">
                    Sites: {row.sites.map((s) => s.name).join(", ") || "—"}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void removeStaff(row.id)}
                >
                  <Trash2 className="size-3.5" />
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
