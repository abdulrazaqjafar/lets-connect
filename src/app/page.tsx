import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  Headphones,
  LayoutGrid,
  Network,
  Router,
  Ticket,
  Wallet,
} from "lucide-react";
import { BrandLogo } from "@/components/brand/logo";
import { buttonVariants } from "@/components/ui/button";
import { formatTzs } from "@/lib/money";
import { PLATFORM_PLANS } from "@/lib/plan-catalog";
import { cn } from "@/lib/utils";

const CAPABILITIES = [
  {
    title: "MikroTik automation",
    body: "One-command onboarding for RouterOS v7. WireGuard, API access and RADIUS configured automatically.",
    icon: Router,
  },
  {
    title: "Local payment gateways",
    body: "Snippe, Selcom, ClickPesa, AzamPay and more — mobile money and card payments built in.",
    icon: Wallet,
  },
  {
    title: "Hotspot vouchers",
    body: "Generate, sell and track prepaid Wi‑Fi vouchers with a branded, self-service captive portal.",
    icon: Ticket,
  },
  {
    title: "Multi-tenant by design",
    body: "Run multiple ISP businesses from one LetsConnect installation with strict data isolation.",
    icon: LayoutGrid,
  },
  {
    title: "Live network visibility",
    body: "Real-time sessions, bandwidth usage, router health and payment collections on one dashboard.",
    icon: Network,
  },
  {
    title: "Customer support built in",
    body: "A ticketing system and SMS/email notifications so your customers always know what is happening.",
    icon: Headphones,
  },
] as const;

const DEVICES = [
  {
    name: "MikroTik",
    subtitle: "RouterOS Integration",
    status: "ready" as const,
    statusLabel: "Ready",
    body: "Transform your MikroTik infrastructure with cloud RADIUS, automated billing, and seamless PPPoE and hotspot voucher management.",
    features: [
      "Cloud User Management",
      "PPPoE Automation",
      "Bandwidth Management",
      "Voucher Portal",
    ],
  },
  {
    name: "TP-Link Omada",
    subtitle: "SDN Controller",
    status: "soon" as const,
    statusLabel: "Coming Soon",
    body: "Connect controller-managed Omada gateways and access points to LetsConnect with external RADIUS authentication, captive-portal billing, and voucher management.",
    features: [
      "Omada Gateways & APs",
      "RADIUS Portal",
      "Payment Gateway",
      "Voucher Management",
    ],
  },
  {
    name: "Ruijie",
    subtitle: "Enterprise WiFi",
    status: "soon" as const,
    statusLabel: "Coming soon",
    body: "Enhance your Ruijie network with advanced captive portals, detailed analytics, and enterprise-grade user management.",
    features: ["Cloud Integration", "Captive Portal", "Enterprise Analytics"],
  },
] as const;

export default function Home() {
  return (
    <main className="min-h-dvh bg-[#071018] text-white">
      <section className="relative isolate min-h-[78vh] overflow-hidden">
        <Image
          src="/images/landing-hero.jpg"
          alt="Mount Kilimanjaro, Tanzania"
          fill
          priority
          className="object-cover object-[center_40%]"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,11,18,0.55)_0%,rgba(5,11,18,0.72)_55%,rgba(7,16,24,0.96)_100%)]" />

        <div className="relative mx-auto flex min-h-[78vh] w-full max-w-6xl flex-col px-5 sm:px-8">
          <header className="flex items-center justify-between gap-3 py-6">
            <BrandLogo inverted />
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className={cn(
                  buttonVariants({
                    variant: "outline",
                    className:
                      "border-white/20 bg-black/25 text-white hover:bg-white/10 hover:text-white",
                  }),
                )}
              >
                Log in
              </Link>
              <Link
                href="/register"
                className={cn(
                  buttonVariants({
                    className: "bg-teal-400 text-slate-950 hover:bg-teal-300",
                  }),
                )}
              >
                Sign up
              </Link>
            </div>
          </header>

          <div className="flex flex-1 flex-col justify-center pb-16 pt-8">
            <p className="text-[11px] font-semibold tracking-[0.2em] text-teal-300 uppercase">
              Tanzania hotspot OS
            </p>
            <h1 className="mt-3 font-heading text-4xl font-semibold tracking-[-0.04em] sm:text-5xl lg:text-6xl">
              Lets<span className="text-[#F78E1E]">Connect</span>
            </h1>
            <p className="mt-4 max-w-lg text-base text-slate-200 sm:text-lg">
              MikroTik automation, local mobile money, vouchers, live network ops,
              and customer support — for ISP businesses that scale.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/register?plan=serengeti"
                className={cn(
                  buttonVariants({
                    size: "lg",
                    className: "bg-teal-400 text-slate-950 hover:bg-teal-300",
                  }),
                )}
              >
                Get started
                <ArrowRight className="size-4" />
              </Link>
              <Link
                href="#devices"
                className={cn(
                  buttonVariants({
                    size: "lg",
                    variant: "outline",
                    className:
                      "border-white/25 bg-black/30 text-white hover:bg-white/10 hover:text-white",
                  }),
                )}
              >
                Supported devices
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section
        id="capabilities"
        className="scroll-mt-8 border-t border-white/5 bg-[#0b1520] px-5 py-16 sm:px-8"
      >
        <div className="mx-auto max-w-6xl">
          <h2 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
            Everything you need to run Wi‑Fi
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            From one-command router setup to prepaid vouchers and live collections —
            built for Tanzanian ISPs and venue operators.
          </p>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {CAPABILITIES.map((item) => (
              <div key={item.title} className="space-y-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-teal-400/10 text-teal-300 ring-1 ring-teal-400/20">
                  <item.icon className="size-4" />
                </div>
                <h3 className="font-heading text-lg font-semibold tracking-tight">
                  {item.title}
                </h3>
                <p className="text-sm leading-relaxed text-slate-400">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        id="devices"
        className="scroll-mt-8 border-t border-white/5 bg-[#071018] px-5 py-16 sm:px-8"
      >
        <div className="mx-auto max-w-6xl">
          <h2 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
            Devices we support
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Start on MikroTik today. Omada and Ruijie are next on the roadmap.
          </p>

          <div className="mt-10 grid gap-8 lg:grid-cols-3">
            {DEVICES.map((device) => (
              <article
                key={device.name}
                className={cn(
                  "flex flex-col border-t pt-6",
                  device.status === "ready"
                    ? "border-teal-400/60"
                    : "border-white/10 opacity-90",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-heading text-xl font-semibold tracking-tight">
                      {device.name}
                    </h3>
                    <p className="mt-0.5 text-sm text-slate-400">{device.subtitle}</p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 text-[11px] font-semibold tracking-wide uppercase",
                      device.status === "ready"
                        ? "text-teal-300"
                        : "text-slate-500",
                    )}
                  >
                    {device.statusLabel}
                  </span>
                </div>
                <p className="mt-4 text-sm leading-relaxed text-slate-400">
                  {device.body}
                </p>
                <ul className="mt-5 space-y-2 text-sm text-slate-300">
                  {device.features.map((feature) => (
                    <li key={feature} className="flex gap-2">
                      <Check
                        className={cn(
                          "mt-0.5 size-3.5 shrink-0",
                          device.status === "ready"
                            ? "text-teal-400"
                            : "text-slate-600",
                        )}
                      />
                      {feature}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="scroll-mt-8 bg-[#0b1520] px-5 py-14 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <h2 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
            Subscriptions
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Monthly pricing · sites included per plan
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {PLATFORM_PLANS.map((plan) => (
              <div
                key={plan.code}
                className={cn(
                  "flex flex-col rounded-2xl border border-white/10 bg-[#101c2a] p-5",
                  plan.highlighted && "border-teal-400/50 ring-1 ring-teal-400/30",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-heading text-lg font-semibold">{plan.name}</p>
                  {plan.highlighted ? (
                    <span className="rounded-full bg-teal-400 px-2 py-0.5 text-[10px] font-bold text-slate-950">
                      Popular
                    </span>
                  ) : null}
                </div>
                <p className="mt-4 font-heading text-3xl font-semibold">
                  {formatTzs(plan.priceAmount)}
                  <span className="text-sm font-medium text-slate-400"> / month</span>
                </p>
                <p className="mt-1 text-sm text-teal-300">
                  {plan.maxSites} site{plan.maxSites === 1 ? "" : "s"}
                </p>
                <ul className="mt-4 space-y-1.5 text-sm text-slate-400">
                  {plan.features.slice(0, 3).map((feature) => (
                    <li key={feature} className="flex gap-2">
                      <Check className="mt-0.5 size-3.5 shrink-0 text-teal-400" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link
                  href={`/register?plan=${plan.code}`}
                  className={cn(
                    buttonVariants({
                      className: plan.highlighted
                        ? "mt-5 bg-teal-400 text-slate-950 hover:bg-teal-300"
                        : "mt-5 border border-white/15 bg-transparent text-white hover:bg-white/10",
                    }),
                  )}
                >
                  Choose
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 bg-[#071018] px-5 py-5 text-center text-xs text-slate-500 sm:px-8">
        Lets Connect · Hotspot OS for Tanzania
      </footer>
    </main>
  );
}
