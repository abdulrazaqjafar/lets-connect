import type { Package, ValidityUnit } from "@prisma/client";
import { validityToMinutes } from "@/lib/packages";

export type RadiusCheckRow = {
  attribute: string;
  op: string;
  value: string;
};

export type RadiusReplyRow = {
  attribute: string;
  op: string;
  value: string;
};

/**
 * MikroTik-Rate-Limit: rx-rate[/tx-rate]
 * rx = from client (upload), tx = to client (download)
 * Examples: "2M/5M", "512k/2M"
 */
export function formatMikrotikRateLimit(
  uploadLimitKbps: number | null | undefined,
  downloadLimitKbps: number | null | undefined,
): string | null {
  if (!uploadLimitKbps && !downloadLimitKbps) return null;

  const format = (kbps: number) => {
    if (kbps >= 1000 && kbps % 1000 === 0) return `${kbps / 1000}M`;
    if (kbps >= 1000) return `${(kbps / 1000).toFixed(1)}M`;
    return `${kbps}k`;
  };

  const up = uploadLimitKbps ? format(uploadLimitKbps) : "0";
  const down = downloadLimitKbps ? format(downloadLimitKbps) : "0";
  return `${up}/${down}`;
}

export function sessionTimeoutSeconds(
  pkg: Pick<Package, "validityValue" | "validityUnit">,
  validUntil?: Date | null,
  now = new Date(),
): number {
  if (validUntil) {
    const remaining = Math.floor((validUntil.getTime() - now.getTime()) / 1000);
    return Math.max(60, remaining);
  }
  return validityToMinutes(pkg.validityValue, pkg.validityUnit as ValidityUnit) * 60;
}

export function buildRadiusAuthRows(username: string, password = username): {
  checks: RadiusCheckRow[];
  replies: RadiusReplyRow[];
} {
  return {
    checks: [
      { attribute: "Cleartext-Password", op: ":=", value: password },
      // Simultaneous-Use often enforced via radcheck
      { attribute: "Simultaneous-Use", op: ":=", value: "1" },
    ],
    replies: [],
  };
}

export function buildRadiusReplyRows(
  pkg: Pick<
    Package,
    | "validityValue"
    | "validityUnit"
    | "downloadLimitKbps"
    | "uploadLimitKbps"
    | "dataLimitMb"
    | "maxDevices"
  >,
  options?: {
    validUntil?: Date | null;
    mac?: string | null;
  },
): { checks: RadiusCheckRow[]; replies: RadiusReplyRow[] } {
  const checks: RadiusCheckRow[] = [];
  const replies: RadiusReplyRow[] = [];

  if (pkg.maxDevices > 1) {
    checks.push({
      attribute: "Simultaneous-Use",
      op: ":=",
      value: String(pkg.maxDevices),
    });
  }

  if (options?.mac) {
    checks.push({
      attribute: "Calling-Station-Id",
      op: "==",
      value: options.mac,
    });
  }

  const timeout = sessionTimeoutSeconds(pkg, options?.validUntil ?? null);
  replies.push({
    attribute: "Session-Timeout",
    op: "=",
    value: String(timeout),
  });
  replies.push({
    attribute: "Idle-Timeout",
    op: "=",
    value: "600",
  });
  replies.push({
    attribute: "Acct-Interim-Interval",
    op: "=",
    value: "300",
  });

  const rate = formatMikrotikRateLimit(
    pkg.uploadLimitKbps,
    pkg.downloadLimitKbps,
  );
  if (rate) {
    replies.push({
      attribute: "Mikrotik-Rate-Limit",
      op: "=",
      value: rate,
    });
  }

  // MikroTik data cap in bytes (total). FreeRADIUS/MikroTik often use Mikrotik-Xmit-Limit / Recv-Limit
  if (pkg.dataLimitMb && pkg.dataLimitMb > 0) {
    const bytes = pkg.dataLimitMb * 1024 * 1024;
    replies.push({
      attribute: "Mikrotik-Total-Limit",
      op: "=",
      value: String(bytes),
    });
  }

  return { checks, replies };
}
