import { formatValidity } from "@/lib/packages";

export type PrintableVoucher = {
  id: string;
  code: string;
  siteName: string;
  package: {
    name: string;
    priceAmount: number;
    priceCurrency: string;
    validityValue: number;
    validityUnit: "HOURS" | "DAYS";
  };
};

const PORTAL_URL =
  process.env.NEXT_PUBLIC_PORTAL_URL?.trim() ||
  process.env.NEXT_PUBLIC_APP_URL?.trim() ||
  "http://18.199.177.29";

export function formatPackagePriceLine(pkg: PrintableVoucher["package"]) {
  const price = `${pkg.priceAmount}/=`;
  const validity = formatValidity(pkg.validityValue, pkg.validityUnit)
    .replace(" hours", " Hours")
    .replace(" hour", " Hour")
    .replace(" days", " Days")
    .replace(" day", " Day");
  return `${price} - ${validity}`;
}

export function VoucherPrintCard({ voucher }: { voucher: PrintableVoucher }) {
  return (
    <article className="voucher-card break-inside-avoid rounded-md border border-slate-800 bg-white p-3 text-slate-900">
      <header className="mb-2 flex items-center gap-2 border-b border-dashed border-slate-300 pb-2">
        <div
          className="flex size-7 items-center justify-center rounded-md bg-[linear-gradient(145deg,#0f766e_0%,#134e4a_100%)] text-white"
          aria-hidden
        >
          <svg viewBox="0 0 24 24" className="size-3.5" fill="none">
            <path d="M12 18.2h.01" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
            <path d="M8.4 14.6a5.2 5.2 0 0 1 7.2 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <path d="M5.5 11.4a9.2 9.2 0 0 1 13 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" opacity="0.75" />
          </svg>
        </div>
        <div className="min-w-0 leading-tight">
          <p className="text-[11px] font-bold tracking-wide">
            Lets<span className="text-teal-700">Connect</span>
          </p>
          <p className="truncate text-[10px] text-slate-600">{voucher.siteName}</p>
        </div>
      </header>

      <p className="text-center text-[11px] font-semibold text-slate-800">
        {formatPackagePriceLine(voucher.package)}
      </p>
      <p className="mt-0.5 text-center text-[9px] text-slate-500">
        {voucher.package.name}
      </p>

      <div className="my-2 rounded border border-slate-300 bg-slate-50 px-2 py-2 text-center">
        <p className="text-[8px] font-medium tracking-[0.18em] text-slate-500 uppercase">
          Voucher code
        </p>
        <p className="mt-0.5 font-mono text-lg font-bold tracking-[0.2em]">
          {voucher.code}
        </p>
      </div>

      <p className="text-center text-[9px] leading-snug text-slate-600">
        Connect to Wi‑Fi, open{" "}
        <span className="font-medium break-all text-slate-800">{PORTAL_URL}</span>
        {" "}and enter this code.
      </p>
    </article>
  );
}
