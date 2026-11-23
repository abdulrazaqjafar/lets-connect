import { randomBytes } from "crypto";
import { z } from "zod";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const optionalInt = z
  .union([z.number(), z.nan(), z.null(), z.undefined()])
  .transform((value) => {
    if (value === null || value === undefined || Number.isNaN(value)) return null;
    return Math.round(value);
  });

export const bulkVoucherSchema = z.object({
  packageId: z.string().min(1, "Package is required"),
  quantity: z.number().int().min(1).max(500),
  prefix: z
    .string()
    .trim()
    .max(8)
    .regex(/^[A-Z0-9]*$/i, "Prefix must be alphanumeric")
    .optional(),
  codeLength: z.number().int().min(6).max(16).default(6),
  /** Days until unused physical vouchers expire (shelf life) */
  shelfLifeDays: optionalInt,
  notes: z.string().trim().max(500).optional(),
});

export type BulkVoucherValues = z.input<typeof bulkVoucherSchema>;
export type BulkVoucherOutput = z.output<typeof bulkVoucherSchema>;

export function generateVoucherCode(length: number, prefix = ""): string {
  const normalizedPrefix = prefix.trim().toUpperCase();
  const bodyLength = Math.max(4, length - normalizedPrefix.length);
  const bytes = randomBytes(bodyLength);
  let body = "";
  for (let i = 0; i < bodyLength; i += 1) {
    body += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
  }
  return `${normalizedPrefix}${body}`;
}

export function generateUniqueCodes(
  quantity: number,
  length: number,
  prefix = "",
  existing = new Set<string>(),
): string[] {
  const codes = new Set<string>();
  let attempts = 0;
  const maxAttempts = quantity * 20;

  while (codes.size < quantity && attempts < maxAttempts) {
    attempts += 1;
    const code = generateVoucherCode(length, prefix);
    if (!existing.has(code) && !codes.has(code)) {
      codes.add(code);
    }
  }

  if (codes.size < quantity) {
    throw new Error(
      "Could not generate enough unique voucher codes. Try a longer code length.",
    );
  }

  return Array.from(codes);
}
