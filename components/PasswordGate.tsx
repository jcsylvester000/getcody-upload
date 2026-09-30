"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Lock } from "lucide-react";
import { AppProvider } from "./AppProvider";

/**
 * Access-code modal shown on EVERY page load (refresh = enter the code again).
 * Nothing is lost: the queue and files are kept in this browser's IndexedDB and
 * reload after unlocking. The code is verified server-side (/api/login), which
 * also unlocks the API for this browser session.
 */
export function PasswordGate({ children }: { children: React.ReactNode }) {
  const [unlocked, setUnlocked] = useState(false);
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  // If the server session expires mid-use, show the modal again (app stays mounted).
  useEffect(() => {
    const lock = () => {
      setUnlocked(false);
      setCode("");
    };
    window.addEventListener("grid:locked", lock);
    return () => window.removeEventListener("grid:locked", lock);
  }, []);

  useEffect(() => {
    if (!unlocked) input.current?.focus();
  }, [unlocked]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const r = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: code }),
    }).catch(() => null);
    setBusy(false);
    if (r?.ok) {
      setUnlocked(true);
      setMounted(true);
    } else {
      setErr((await r?.json().catch(() => null))?.message ?? "Couldn't reach the server.");
      setCode("");
      input.current?.focus();
    }
  }

  // Once unlocked the app stays mounted, so a later re-lock keeps all on-screen state.
  const [mounted, setMounted] = useState(false);

  return (
    <>
      {mounted && (
        <div aria-hidden={!unlocked} inert={!unlocked}>
          <AppProvider>{children}</AppProvider>
        </div>
      )}
      {!unlocked && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="gate-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-midnight/85 p-4 backdrop-blur-sm"
        >
          <form onSubmit={submit} className="w-full max-w-sm rounded-card bg-surface p-8 shadow-2xl">
            <Image src="/brand/grid-logo-light.png" alt="GRID Property Ventures" width={170} height={44} priority />
            <div className="brand-rule mt-5 rounded-full" aria-hidden="true" />
            <h1 id="gate-title" className="mt-5 flex items-center gap-2 font-display text-2xl text-nile">
              <Lock className="size-5 text-muesli" aria-hidden="true" /> Access code
            </h1>
            <p className="mt-1 text-sm text-muted">Enter the code to open the Cody Uploader.</p>
            <label htmlFor="access-code" className="sr-only">Access code</label>
            <input
              ref={input}
              id="access-code"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="mt-5 w-full rounded-control border border-line-strong px-3 py-3 text-center text-xl tracking-[0.5em]"
              placeholder="••••••"
              required
            />
            {err && <p className="mt-2 text-sm text-danger" role="alert">{err}</p>}
            <button
              type="submit"
              disabled={busy || !code}
              className="mt-4 w-full rounded-control bg-nile px-4 py-3 text-sm font-semibold text-white hover:bg-midnight disabled:bg-iron disabled:text-muted"
            >
              {busy ? "Checking…" : "Unlock"}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
