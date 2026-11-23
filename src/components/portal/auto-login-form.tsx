"use client";

import { useEffect, useRef } from "react";

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
  onSubmitted,
}: {
  login: MikroTikLoginPayload;
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
    }, 600);

    return () => window.clearTimeout(timer);
  }, [login, onSubmitted]);

  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-5 text-center text-emerald-950">
      <p className="text-sm font-medium">Payment received</p>
      <p className="mt-1 text-sm text-emerald-800/80">
        Connecting you to Wi‑Fi…
      </p>
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
