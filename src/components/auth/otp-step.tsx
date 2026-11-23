"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type OtpStepProps = {
  destinationMasked: string;
  channel: string;
  demo?: boolean;
  debugOtp?: string;
  code: string;
  onCodeChange: (value: string) => void;
  onVerify: () => void;
  onBack: () => void;
  submitting?: boolean;
  message?: string;
};

export function OtpStep({
  destinationMasked,
  channel,
  demo,
  debugOtp,
  code,
  onCodeChange,
  onVerify,
  onBack,
  submitting,
  message,
}: OtpStepProps) {
  return (
    <div className="grid gap-4">
      <div>
        <p className="text-sm text-slate-600">
          Enter the 6-digit code sent via {channel === "EMAIL" ? "email" : "SMS"}{" "}
          to <span className="font-medium text-slate-900">{destinationMasked}</span>
        </p>
        {message ? (
          <p className="mt-1 text-xs text-slate-500">{message}</p>
        ) : null}
        {demo && debugOtp ? (
          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-950 ring-1 ring-amber-200">
            Demo mode — your OTP is <strong className="font-mono">{debugOtp}</strong>
          </p>
        ) : null}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="otp">Verification code</Label>
        <Input
          id="otp"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="••••••"
          value={code}
          onChange={(e) =>
            onCodeChange(e.target.value.replace(/\D/g, "").slice(0, 6))
          }
          className="h-12 text-center font-mono text-xl tracking-[0.35em]"
        />
      </div>
      <Button
        type="button"
        className="h-10 bg-[#00338D] text-white hover:bg-[#00266b]"
        disabled={submitting || code.length < 6}
        onClick={onVerify}
      >
        {submitting ? "Verifying…" : "Verify & continue"}
      </Button>
      <button
        type="button"
        className="text-sm text-slate-500 hover:text-slate-800"
        onClick={onBack}
      >
        ← Back
      </button>
    </div>
  );
}
