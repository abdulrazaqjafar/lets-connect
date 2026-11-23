import { randomBytes } from "crypto";

/** Lightweight cuid-like id for voucher batches without extra deps */
export function createId(prefix = "batch"): string {
  return `${prefix}_${randomBytes(12).toString("hex")}`;
}
