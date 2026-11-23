import type { VenueType } from "@prisma/client";

export const VENUE_OPTIONS: {
  value: VenueType;
  label: string;
  blurb: string;
  packageIdeas: string[];
}[] = [
  {
    value: "GUESTHOUSE",
    label: "Guesthouse / Lodge",
    blurb: "Guests buy hourly or nightly Wi‑Fi at the desk or on their phone.",
    packageIdeas: ["Saa 1", "Saa 6", "Usiku (12h)", "Siku 1"],
  },
  {
    value: "CAFE",
    label: "Café",
    blurb: "Short sessions for customers — QR / Sign-in to network.",
    packageIdeas: ["Dakika 30", "Saa 1", "Saa 3"],
  },
  {
    value: "RESTAURANT",
    label: "Restaurant",
    blurb: "Table Wi‑Fi with cash vouchers or mobile money.",
    packageIdeas: ["Saa 1", "Saa 2", "Family table"],
  },
  {
    value: "BUS",
    label: "Daladala / Coach",
    blurb: "Onboard hotspot — vouchers sold by conductor or STK.",
    packageIdeas: ["Safari (3h)", "Safari (6h)", "Full trip"],
  },
  {
    value: "CAMPUS",
    label: "Campus / Hostel",
    blurb: "Student packs by day or week with speed caps.",
    packageIdeas: ["Siku 1", "Wiki 1", "Mwezi"],
  },
  {
    value: "EVENT",
    label: "Event / Hall",
    blurb: "Day-pass codes for conferences and weddings.",
    packageIdeas: ["Event day", "VIP day"],
  },
  {
    value: "OFFICE",
    label: "Office / Cowork",
    blurb: "Guest Wi‑Fi separate from staff LAN.",
    packageIdeas: ["Guest 2h", "Guest day"],
  },
  {
    value: "OTHER",
    label: "Other venue",
    blurb: "General hotspot site.",
    packageIdeas: ["Saa 1", "Siku 1"],
  },
];

export function venueLabel(type: VenueType | string | null | undefined) {
  return VENUE_OPTIONS.find((v) => v.value === type)?.label ?? "Hotspot venue";
}
