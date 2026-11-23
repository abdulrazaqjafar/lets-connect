import { PageHeader } from "@/components/dashboard/page-header";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function PppoePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Network"
        title="PPPoE sessions"
        description="RADIUS-backed PPPoE is prepared in Router setup. Live session grid ships next."
      />
      <div className="lc-panel rounded-2xl p-6 text-sm text-slate-600">
        <p>
          Enable the <strong>PPPoE</strong> service when generating the MikroTik install
          command. The router will register a PPP RADIUS client against Lets Connect AAA.
        </p>
        <Link
          href="/dashboard/router-setup"
          className={cn(buttonVariants({ className: "mt-4 bg-[#00338D] text-white" }))}
        >
          Open Router setup
        </Link>
      </div>
    </div>
  );
}
