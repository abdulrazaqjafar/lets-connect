/**
 * Build MikroTik Hotspot login URL after payment / voucher redeem.
 * Prefers link-login-only from the captive redirect; falls back to gateway login.
 */
export function buildAutoLoginUrl(opts: {
  username: string;
  password: string;
  linkLoginOnly?: string | null;
  fallbackBase?: string;
}): string {
  const fallback =
    opts.fallbackBase ??
    process.env.MIKROTIK_LOGIN_URL ??
    "http://10.5.5.1/login";

  let base = (opts.linkLoginOnly && opts.linkLoginOnly.trim()) || fallback;

  // link-login-only may already include query string — strip to path for clean rebuild
  try {
    const url = new URL(base);
    url.search = "";
    url.searchParams.set("username", opts.username);
    url.searchParams.set("password", opts.password);
    return url.toString();
  } catch {
    const cleaned = base.split("?")[0] ?? fallback;
    const sep = cleaned.includes("?") ? "&" : "?";
    return `${cleaned}${sep}username=${encodeURIComponent(opts.username)}&password=${encodeURIComponent(opts.password)}`;
  }
}
