"use client";

import { useCallback, useEffect, useState } from "react";
import { MessageSquarePlus, Send } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type TicketMessage = {
  id: string;
  body: string;
  isInternal: boolean;
  createdAt: string;
  author: { id: string; name: string | null; email: string } | null;
};

type TicketListItem = {
  id: string;
  subject: string;
  status: string;
  priority: string;
  customerPhone: string | null;
  customerEmail: string | null;
  updatedAt: string;
  site: { id: string; name: string } | null;
  messages: { body: string; createdAt: string }[];
  _count: { messages: number };
};

type TicketDetail = Omit<TicketListItem, "messages"> & {
  messages: TicketMessage[];
};

export function SupportDesk() {
  const [tickets, setTickets] = useState<TicketListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [reply, setReply] = useState("");
  const [creating, setCreating] = useState(false);

  const loadTickets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/support/tickets");
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error ?? "Failed to load tickets");
      setTickets(payload.tickets ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    const res = await fetch(`/api/support/tickets/${id}`);
    const payload = await res.json();
    if (!res.ok) {
      toast.error(payload.error ?? "Failed to open ticket");
      return;
    }
    setDetail(payload.ticket);
  }, []);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  async function createTicket() {
    if (!subject.trim() || !body.trim()) {
      toast.error("Subject and message are required");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          body,
          customerPhone: customerPhone || null,
        }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error ?? "Could not create ticket");
      toast.success("Ticket opened — customer notified if phone set");
      setSubject("");
      setBody("");
      setCustomerPhone("");
      await loadTickets();
      setSelectedId(payload.ticket.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed");
    } finally {
      setCreating(false);
    }
  }

  async function sendReply() {
    if (!selectedId || !reply.trim()) return;
    const res = await fetch(`/api/support/tickets/${selectedId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: reply, status: "IN_PROGRESS" }),
    });
    const payload = await res.json();
    if (!res.ok) {
      toast.error(payload.error ?? "Reply failed");
      return;
    }
    setReply("");
    setDetail(payload.ticket);
    toast.success("Reply sent");
    await loadTickets();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Support"
        title="Customer tickets"
        description="Track issues and notify customers by SMS or email."
      />

      <div className="grid gap-4 xl:grid-cols-[20rem_1fr]">
        <div className="space-y-4">
          <section className="lc-panel rounded-2xl p-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <MessageSquarePlus className="size-4" />
              New ticket
            </h2>
            <div className="mt-3 space-y-2">
              <div>
                <Label htmlFor="subject">Subject</Label>
                <Input
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Slow Wi‑Fi on floor 2"
                />
              </div>
              <div>
                <Label htmlFor="phone">Customer phone (SMS)</Label>
                <Input
                  id="phone"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="07XXXXXXXX"
                />
              </div>
              <div>
                <Label htmlFor="body">Message</Label>
                <textarea
                  id="body"
                  className="min-h-20 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
              </div>
              <Button
                className="w-full bg-teal-700 text-white hover:bg-teal-800"
                disabled={creating}
                onClick={() => void createTicket()}
              >
                Open ticket
              </Button>
            </div>
          </section>

          <section className="lc-panel max-h-[28rem] overflow-y-auto rounded-2xl p-2">
            {loading ? (
              <p className="p-3 text-sm text-slate-500">Loading…</p>
            ) : tickets.length === 0 ? (
              <p className="p-3 text-sm text-slate-500">No tickets yet.</p>
            ) : (
              tickets.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedId(t.id)}
                  className={`w-full rounded-xl px-3 py-2.5 text-left transition ${
                    selectedId === t.id
                      ? "bg-teal-50 ring-1 ring-teal-200"
                      : "hover:bg-slate-50"
                  }`}
                >
                  <p className="truncate text-sm font-medium text-slate-900">
                    {t.subject}
                  </p>
                  <p className="text-xs text-slate-500">
                    {t.status} · {t._count.messages} msg
                  </p>
                </button>
              ))
            )}
          </section>
        </div>

        <section className="lc-panel rounded-2xl p-5">
          {!detail ? (
            <p className="text-sm text-slate-500">Select a ticket to view the thread.</p>
          ) : (
            <>
              <div className="border-b border-slate-100 pb-3">
                <h2 className="font-heading text-lg font-semibold text-slate-900">
                  {detail.subject}
                </h2>
                <p className="text-sm text-slate-500">
                  {detail.status} · {detail.priority}
                  {detail.site ? ` · ${detail.site.name}` : ""}
                </p>
              </div>
              <div className="mt-4 max-h-[22rem] space-y-3 overflow-y-auto">
                {detail.messages.map((m) => (
                  <div
                    key={m.id}
                    className={`rounded-xl px-3 py-2 text-sm ${
                      m.isInternal ? "bg-amber-50" : "bg-slate-50"
                    }`}
                  >
                    <p className="text-xs text-slate-500">
                      {m.author?.name ?? m.author?.email ?? "Customer / system"} ·{" "}
                      {new Date(m.createdAt).toLocaleString()}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-slate-800">{m.body}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex gap-2">
                <Input
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Reply to customer…"
                />
                <Button onClick={() => void sendReply()}>
                  <Send className="size-4" />
                </Button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
