import Link from "next/link";
import { BrandLogo } from "@/components/brand/logo";

export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[#071018] px-4 py-10">
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(45,212,191,0.12),transparent_55%),linear-gradient(180deg,#071018,#0b1520)]"
      />
      <div className="relative w-full max-w-md space-y-5">
        <Link href="/" className="inline-flex">
          <BrandLogo inverted />
        </Link>
        <div className="rounded-3xl border border-white/10 bg-white p-6 shadow-[0_40px_80px_-40px_rgba(0,0,0,0.8)] sm:p-8">
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-slate-950">
            {title}
          </h1>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
          <div className="mt-6">{children}</div>
          {footer ? <div className="mt-5 text-sm text-slate-500">{footer}</div> : null}
        </div>
      </div>
    </main>
  );
}
