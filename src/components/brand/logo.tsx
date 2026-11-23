import Image from "next/image";
import { cn } from "@/lib/utils";

type LogoProps = {
  className?: string;
  /** @deprecated kept for call-site compatibility — full logo includes wordmark */
  markClassName?: string;
  showWordmark?: boolean;
  /** On dark surfaces; logo already has blue/orange contrast */
  inverted?: boolean;
  /** Visual size preset */
  size?: "sm" | "md" | "lg";
};

const SIZES = {
  sm: { width: 120, height: 120, className: "h-9 w-auto" },
  md: { width: 160, height: 160, className: "h-11 w-auto" },
  lg: { width: 220, height: 220, className: "h-14 w-auto sm:h-16" },
} as const;

/** Official Lets Connect brand mark + wordmark */
export function BrandLogo({
  className,
  showWordmark = true,
  size = "md",
}: LogoProps) {
  const dims = SIZES[size];

  return (
    <div className={cn("inline-flex items-center", className)}>
      <Image
        src={
          showWordmark
            ? "/brand/lets-connect-logo.png"
            : "/brand/lets-connect-mark.png"
        }
        alt="Lets Connect"
        width={dims.width}
        height={dims.height}
        className={cn(dims.className, "object-contain")}
        priority
      />
    </div>
  );
}
