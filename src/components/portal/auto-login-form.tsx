"use client";

import { useEffect, useRef } from "react";
import { Loader2, Wifi } from "lucide-react";

export type MikroTikLoginPayload = {
  username: string;
  password: string;
  linkLoginOnly: string;
  chapId?: string | null;
  chapChallenge?: string | null;
  linkOrig?: string | null;
};

/**
 * Hidden form that POSTs credentials to MikroTik's link-login-only CGI.
 * This is the standard captive-portal auto-login pattern.
 */
export function AutoLoginForm({
  login,
  brandColor = "#14b8a6",
  onSubmitted,
}: {
  login: MikroTikLoginPayload;
  brandColor?: string;
  onSubmitted?: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const submitted = useRef(false);

  useEffect(() => {
    if (submitted.current) return;
    submitted.current = true;

    const timer = window.setTimeout(() => {
      onSubmitted?.();
      formRef.current?.submit();
    }, 700);

    return () => window.clearTimeout(timer);
  }, [login, onSubmitted]);

  return (
    <div className="relative overflow-hidden px-6 py-12 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-90"
        style={{
          background: `radial-gradient(ellipse 80% 60% at 50% 0%, color-mix(in srgb, ${brandColor} 18%, white), transparent 70%)`,
        }}
      />
      <div className="relative">
        <div
          className="mx-auto flex size-14 items-center justify-center rounded-2xl text-white shadow-lg"
          style={{
            backgroundColor: brandColor,
            boxShadow: `0 16px 32px -14px color-mix(in srgb, ${brandColor} 80%, transparent)`,
          }}
        >
          <Wifi className="size-6" />
        </div>
        <p className="mt-5 font-heading text-xl font-semibold tracking-tight text-slate-950">
          You&apos;re online
        </p>
        <p className="mx-auto mt-2 max-w-[16rem] text-sm leading-relaxed text-slate-500">
          Session approved. Connecting you to the network…
        </p>
        <div className="mt-6 inline-flex items-center gap-2 text-sm text-slate-600">
          <Loader2
            className="size-4 animate-spin"
            style={{ color: brandColor }}
          />
          Starting Wi‑Fi session
        </div>
      </div>
      <form
        ref={formRef}
        method="POST"
        action={login.linkLoginOnly}
        className="hidden"
        aria-hidden
      >
        <input type="hidden" name="username" value={login.username} />
        <input type="hidden" name="password" value={login.password} />
        {login.chapId ? (
          <input type="hidden" name="chap-id" value={login.chapId} />
        ) : null}
        {login.chapChallenge ? (
          <input type="hidden" name="chap-challenge" value={login.chapChallenge} />
        ) : null}
        {login.linkOrig ? (
          <input type="hidden" name="dst" value={login.linkOrig} />
        ) : null}
        <input type="hidden" name="popup" value="true" />
      </form>
    </div>
  );
}
