"use client";

import { useState } from "react";
import Image from "next/image";

export default function LoginPage() {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const r = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pw }),
    });
    setBusy(false);
    if (r.ok) window.location.href = "/";
    else setErr((await r.json().catch(() => null))?.message ?? "Sign-in failed.");
  }

  return (
    <div className="mx-auto mt-16 max-w-sm rounded-card border border-line bg-surface p-8 shadow-card">
      <Image src="/brand/grid-logo-light.png" alt="GRID Property Ventures" width={180} height={47} priority />
      <h1 className="mt-6 font-display text-2xl text-nile">Cody Uploader</h1>
      <p className="mt-1 text-sm text-muted">Enter the team password to continue.</p>
      <form onSubmit={submit} className="mt-6 space-y-3">
        <label className="block text-sm font-medium" htmlFor="pw">Password</label>
        <input
          id="pw"
          type="password"
          autoComplete="current-password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          className="w-full rounded-control border border-line-strong px-3 py-2.5 text-sm"
          required
        />
        {err && <p className="text-sm text-danger" role="alert">{err}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-control bg-nile px-4 py-2.5 text-sm font-semibold text-white hover:bg-midnight disabled:opacity-60"
        >
          {busy ? "Checking…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
