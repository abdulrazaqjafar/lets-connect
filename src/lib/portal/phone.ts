/** Normalize KE/TZ mobile numbers for M-Pesa / Tigo / Airtel. */
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/[^\d+]/g, "").trim();
  if (!digits) return null;

  let local = digits;
  if (local.startsWith("+")) local = local.slice(1);

  // Kenya: 07… / 01… → 254…
  if (/^0[17]\d{8}$/.test(local)) {
    return `254${local.slice(1)}`;
  }
  // Tanzania: 06… / 07… → 255… (Vodacom, Tigo, Airtel, Halotel, etc.)
  if (/^0[67]\d{8}$/.test(local)) {
    return `255${local.slice(1)}`;
  }
  if (/^254[17]\d{8}$/.test(local)) return local;
  if (/^255[67]\d{8}$/.test(local)) return local;

  return null;
}

export function phoneLooksValid(input: string): boolean {
  return normalizePhone(input) !== null;
}

/** Best-effort provider hint from MSISDN (TZ-focused). */
export function detectMobileMoneyProvider(
  phone: string,
): "MPESA" | "TIGO_PESA" | "AIRTEL_MONEY" | null {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;

  // Tanzania national significant number after 255
  if (normalized.startsWith("255")) {
    const prefix = normalized.slice(3, 5);
    // Vodacom M-Pesa: 74–76
    if (["74", "75", "76"].includes(prefix)) return "MPESA";
    // Tigo / Yas: 71–73
    if (["71", "72", "73"].includes(prefix)) return "TIGO_PESA";
    // Airtel: 68–69
    if (["68", "69"].includes(prefix)) return "AIRTEL_MONEY";
    // Halotel / others — default M-Pesa path for STK demos
    return "MPESA";
  }

  // Kenya — Safaricom M-Pesa by default
  if (normalized.startsWith("254")) return "MPESA";

  return null;
}
