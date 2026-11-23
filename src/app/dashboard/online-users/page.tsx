import { NetworkOpsPanel } from "@/components/dashboard/network-ops-panel";

/** Live Hotspot sessions — competitor dashboards call this “Online users”. */
export default function OnlineUsersPage() {
  return (
    <NetworkOpsPanel
      title="Online users"
      description="Live Hotspot sessions from FreeRADIUS — MAC, IP, bandwidth, and time online."
    />
  );
}
