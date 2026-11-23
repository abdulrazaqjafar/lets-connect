"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type SiteOption = {
  id: string;
  name: string;
  nasIdentifier: string;
};

type SitePickerProps = {
  sites: SiteOption[];
  value: string;
  onChange: (siteId: string) => void;
};

export function SitePicker({ sites, value, onChange }: SitePickerProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="site">Hotspot site</Label>
      <Select value={value} onValueChange={(next) => next && onChange(next)}>
        <SelectTrigger id="site" className="w-full min-w-[220px] sm:w-72">
          <SelectValue placeholder="Select a site" />
        </SelectTrigger>
        <SelectContent>
          {sites.map((site) => (
            <SelectItem key={site.id} value={site.id}>
              {site.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
