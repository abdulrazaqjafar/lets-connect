/**
 * Platform SaaS plans (TZS / month) — shared client + server catalog.
 */
export const PLATFORM_PLANS = [
  {
    code: "ngorongoro",
    name: "Ngorongoro",
    description: "Start with one site — ideal for a shop or cafe.",
    priceAmount: 15_000,
    maxSites: 1,
    sortOrder: 1,
    highlighted: false,
    features: [
      "1 hotspot site",
      "Cash vouchers + portal",
      "MikroTik script",
      "RADIUS sessions",
    ],
  },
  {
    code: "serengeti",
    name: "Serengeti",
    description: "Grow to a few branches with up to 3 sites.",
    priceAmount: 25_000,
    maxSites: 3,
    sortOrder: 2,
    highlighted: true,
    features: [
      "Up to 3 sites",
      "Analytics dashboard",
      "Bulk voucher printing",
      "Priority support (chat)",
    ],
  },
  {
    code: "mikumi",
    name: "Mikumi",
    description: "Multi-location coverage for neighborhood networks.",
    priceAmount: 35_000,
    maxSites: 7,
    sortOrder: 3,
    highlighted: false,
    features: [
      "Up to 7 sites",
      "Multi-site analytics",
      "RADIUS PoD disconnect",
      "Operator onboarding help",
    ],
  },
  {
    code: "kilimanjaro",
    name: "Kilimanjaro",
    description: "Top tier for chains and small ISPs.",
    priceAmount: 50_000,
    maxSites: 15,
    sortOrder: 4,
    highlighted: false,
    features: [
      "Up to 15 sites",
      "All Serengeti + Mikumi features",
      "Dedicated success check-ins",
      "Custom walled-garden help",
    ],
  },
] as const;

export type PlatformPlanCode = (typeof PLATFORM_PLANS)[number]["code"];

export function isPlatformPlanCode(value: string): value is PlatformPlanCode {
  return PLATFORM_PLANS.some((plan) => plan.code === value);
}
