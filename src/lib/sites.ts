import { randomBytes } from "crypto";
import { z } from "zod";

export const siteFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  location: z.string().trim().min(1, "Location is required").max(200),
  routerModel: z.string().trim().min(1, "Router model is required").max(80),
  venueType: z.enum([
    "GUESTHOUSE",
    "CAFE",
    "RESTAURANT",
    "BUS",
    "CAMPUS",
    "EVENT",
    "OFFICE",
    "OTHER",
  ]),
});

export type SiteFormValues = z.infer<typeof siteFormSchema>;

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "site";
}

export function generateNasIdentifier(name: string): string {
  const base = slugify(name).replace(/-/g, "").slice(0, 8).toUpperCase() || "SITE";
  const suffix = randomBytes(3).toString("hex").toUpperCase();
  return `NAS-${base}-${suffix}`;
}

export function generateRadiusSecret(): string {
  return randomBytes(16).toString("base64url");
}
