import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PortalIndexProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * Legacy /portal entry — prefer /portal/[siteId]?mac=&ip=&link-login-only=&user-data=
 */
export default async function PortalIndexPage({ searchParams }: PortalIndexProps) {
  const params = await searchParams;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") qs.set(key, value);
    else if (Array.isArray(value) && value[0]) qs.set(key, value[0]);
  }

  const siteHint =
    (typeof params.site === "string" && params.site) ||
    (typeof params.siteId === "string" && params.siteId) ||
    null;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-4 px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Lets Connect Portal</h1>
      <p className="text-sm text-muted-foreground">
        Open the captive portal at{" "}
        <code className="rounded bg-muted px-1">/portal/[siteId]</code> with MikroTik
        parameters:{" "}
        <code className="rounded bg-muted px-1">mac</code>,{" "}
        <code className="rounded bg-muted px-1">ip</code>,{" "}
        <code className="rounded bg-muted px-1">link-login-only</code>,{" "}
        <code className="rounded bg-muted px-1">user-data</code>.
      </p>
      {siteHint ? (
        <Link
          href={`/portal/${siteHint}${qs.toString() ? `?${qs.toString()}` : ""}`}
          className={cn(
            buttonVariants({
              className: "bg-teal-700 text-white hover:bg-teal-800",
            }),
          )}
        >
          Continue to site {siteHint}
        </Link>
      ) : null}
    </main>
  );
}
