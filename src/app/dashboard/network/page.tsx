import { NetworkOpsPanel } from "@/components/dashboard/network-ops-panel";

export default function NetworkPage() {
  return (
    <NetworkOpsPanel
      title="Network map"
      description="Router health, live sessions, bandwidth, and today’s payment collections."
    />
  );
}
