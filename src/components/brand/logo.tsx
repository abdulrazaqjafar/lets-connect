import { cn } from "@/lib/utils";

type LogoProps = {
  className?: string;
  markClassName?: string;
  showWordmark?: boolean;
  inverted?: boolean;
};

/** Lets-Connect wordmark + signal mark */
export function BrandLogo({
  className,
  markClassName,
  showWordmark = true,
  inverted = false,
}: LogoProps) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div
        className={cn(
          "relative flex size-9 items-center justify-center overflow-hidden rounded-xl",
          inverted
            ? "bg-white/12 ring-1 ring-white/20"
            : "bg-[linear-gradient(145deg,#0f766e_0%,#134e4a_100%)] shadow-[0_8px_20px_-8px_rgba(15,118,110,0.65)]",
          markClassName,
        )}
        aria-hidden
      >
        <svg viewBox="0 0 24 24" className="size-[1.125rem] text-white" fill="none">
          <path
            d="M12 18.2h.01"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <path
            d="M8.4 14.6a5.2 5.2 0 0 1 7.2 0"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="M5.5 11.4a9.2 9.2 0 0 1 13 0"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            opacity="0.75"
          />
          <path
            d="M2.8 8.2a13.2 13.2 0 0 1 18.4 0"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            opacity="0.45"
          />
        </svg>
      </div>
      {showWordmark ? (
        <div className="leading-none">
          <p
            className={cn(
              "font-heading text-[15px] font-semibold tracking-[-0.02em]",
              inverted ? "text-white" : "text-slate-900",
            )}
          >
            Lets<span className={inverted ? "text-teal-300" : "text-teal-700"}>Connect</span>
          </p>
          <p
            className={cn(
              "mt-0.5 text-[10px] font-medium tracking-[0.16em] uppercase",
              inverted ? "text-slate-400" : "text-slate-500",
            )}
          >
            Hotspot OS
          </p>
        </div>
      ) : null}
    </div>
  );
}
