"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

/** Unknown URL → send the user to the dashboard instead of a dead end. */
export default function NotFound() {
  const router = useRouter();
  useEffect(() => {
    const t = setTimeout(() => router.replace("/dashboard"), 1500);
    return () => clearTimeout(t);
  }, [router]);
  return (
    <div className="mx-auto mt-16 max-w-md rounded-card border border-line bg-surface p-8 text-center shadow-card">
      <p className="font-display text-2xl text-nile">Page not found</p>
      <p className="mt-2 text-sm text-muted">Taking you to the dashboard…</p>
      <Link href="/dashboard" className="mt-4 inline-block text-sm font-semibold text-nile underline">
        Go now
      </Link>
    </div>
  );
}
