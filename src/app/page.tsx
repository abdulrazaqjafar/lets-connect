import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { BrandLogo } from "@/components/brand/logo";
import { buttonVariants } from "@/components/ui/button";
import { formatTzs } from "@/lib/money";
import { PLATFORM_PLANS } from "@/lib/plan-catalog";
import { cn } from "@/lib/utils";

export default function Home() {
  return (
    <main className="min-h-dvh bg-[#071018] text-white">
      {/* Hero only — shared background image */}
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
              Tanzania
            </p>
            <h1 className="mt-3 font-heading text-4xl font-semibold tracking-[-0.04em] sm:text-5xl lg:text-6xl">
              Lets<span className="text-teal-300">Connect</span>
            </h1>
            <p className="mt-4 max-w-md text-base text-slate-200 sm:text-lg">
              Manage Wi‑Fi sites, vouchers, and MikroTik — after you sign in.
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
                href="#pricing"
                className={cn(
                  buttonVariants({
                    size: "lg",
                    variant: "outline",
                    className:
                      "border-white/25 bg-black/30 text-white hover:bg-white/10 hover:text-white",
                  }),
                )}
              >
                Pricing
              </Link>
            </div>
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
