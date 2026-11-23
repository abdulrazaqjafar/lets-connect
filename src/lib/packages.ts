import { ValidityUnit } from "@prisma/client";
import { z } from "zod";

const optionalNumber = z
  .union([z.number(), z.nan(), z.null(), z.undefined()])
  .transform((value) => {
    if (value === null || value === undefined || Number.isNaN(value)) return null;
    return value;
  });

const speedString = z
  .string()
  .trim()
  .refine(
    (value) => value === "" || /^(\d+(?:\.\d+)?)\s*[kKmM]?$/.test(value),
    "Use format like 2M or 512k",
  );

/** Parse MikroTik-style speeds: 2M, 5M, 512k, 1.5M */
export function parseSpeedToKbps(input: string | null | undefined): number | null {
  if (!input) return null;
  const raw = input.trim().toLowerCase();
  if (!raw || raw === "0" || raw === "unlimited") return null;

  const match = raw.match(/^(\d+(?:\.\d+)?)\s*([km])?(?:bps|bit)?$/i);
  if (!match) return null;

  const amount = Number(match[1]);
  const unit = (match[2] ?? "m").toLowerCase();
  if (Number.isNaN(amount) || amount <= 0) return null;

  if (unit === "k") return Math.round(amount);
  return Math.round(amount * 1000);
}

/** Format Kbps as MikroTik-style string (2M, 512k) */
export function formatSpeedMikrotik(kbps: number | null | undefined): string {
  if (!kbps) return "";
  if (kbps >= 1000 && kbps % 1000 === 0) return `${kbps / 1000}M`;
  if (kbps >= 1000) {
    const mbps = kbps / 1000;
    return `${Number.isInteger(mbps) ? mbps : mbps.toFixed(1)}M`;
  }
  return `${kbps}k`;
}

export const packageFormSchema = z.object({
  siteId: z.string().min(1, "Site is required"),
  name: z.string().trim().min(1, "Name is required").max(100),
  description: z.string().trim().max(500).optional(),
  priceAmount: z.number().int().min(0, "Price must be 0 or more"),
  priceCurrency: z.string().trim().min(1).max(8).default("TZS"),
  /** Duration in hours (Sprint 2) */
  durationHours: z.number().int().min(1, "Duration must be at least 1 hour"),
  /** e.g. 2M */
  uploadSpeed: speedString,
  /** e.g. 5M */
  downloadSpeed: speedString,
  dataLimitMb: optionalNumber,
  maxDevices: z.number().int().min(1).max(50).default(1),
  isActive: z.boolean().default(true),
});

export type PackageFormValues = z.input<typeof packageFormSchema>;
export type PackageFormOutput = z.output<typeof packageFormSchema>;

export function mbpsToKbps(mbps: number | null | undefined): number | null {
  if (mbps === null || mbps === undefined || Number.isNaN(mbps)) return null;
  if (mbps <= 0) return null;
  return Math.round(mbps * 1000);
}

export function kbpsToMbps(kbps: number | null | undefined): number | null {
  if (kbps === null || kbps === undefined) return null;
  return Math.round((kbps / 1000) * 100) / 100;
}

export function validityToMinutes(value: number, unit: ValidityUnit): number {
  return unit === "DAYS" ? value * 24 * 60 : value * 60;
}

export function formatValidity(value: number, unit: ValidityUnit): string {
  const label =
    unit === "DAYS" ? (value === 1 ? "day" : "days") : value === 1 ? "hour" : "hours";
  return `${value} ${label}`;
}

export function formatSpeed(kbps: number | null | undefined): string {
  if (!kbps) return "Unlimited";
  return formatSpeedMikrotik(kbps) || "Unlimited";
}

export function toPackageCreateData(values: PackageFormOutput) {
  return {
    siteId: values.siteId,
    name: values.name,
    description: values.description?.trim() ? values.description.trim() : null,
    priceAmount: values.priceAmount,
    priceCurrency: values.priceCurrency || "TZS",
    validityValue: values.durationHours,
    validityUnit: "HOURS" as ValidityUnit,
    downloadLimitKbps: parseSpeedToKbps(values.downloadSpeed),
    uploadLimitKbps: parseSpeedToKbps(values.uploadSpeed),
    dataLimitMb:
      values.dataLimitMb === null ||
      values.dataLimitMb === undefined ||
      values.dataLimitMb <= 0
        ? null
        : Math.round(values.dataLimitMb),
    maxDevices: values.maxDevices,
    isActive: values.isActive,
  };
}
