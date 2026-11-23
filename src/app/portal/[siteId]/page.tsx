import type { Metadata, Viewport } from "next";
import { SitePortal } from "@/components/portal/site-portal";

export const metadata: Metadata = {
  title: "Wi‑Fi Portal · Lets Connect",
  description: "Pay with mobile money or enter a cash voucher",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

type PortalSitePageProps = {
  params: Promise<{ siteId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PortalSitePage({
  params,
  searchParams,
}: PortalSitePageProps) {
  const { siteId } = await params;
  const query = await searchParams;
  const qs = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (typeof value === "string") qs.set(key, value);
    else if (Array.isArray(value) && value[0]) qs.set(key, value[0]);
  }

  return <SitePortal siteId={siteId} queryString={qs.toString()} />;
}
