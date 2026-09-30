"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useApp } from "./AppProvider";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/", label: "Uploader" },
  { href: "/board", label: "Board" },
];

export function AppHeader() {
  const path = usePathname();
  const { queue } = useApp();
  const active = queue.items.filter((x) => ["queued", "uploading", "uploaded", "syncing"].includes(x.status)).length;

  return (
    <header className="bg-midnight text-white">
      <div className="mx-auto flex w-full max-w-[1600px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-4 rounded-control">
          <Image src="/brand/grid-logo-dark.png" alt="GRID Property Ventures" width={150} height={39} priority />
          <span className="hidden h-6 w-px bg-white/20 sm:block" aria-hidden="true" />
          <span className="hidden text-sm font-medium text-white/80 sm:inline">Cody Uploader</span>
        </Link>
        <nav aria-label="Main" className="ml-auto flex items-center gap-1 text-sm">
          {NAV.map((n) => {
            const on = n.href === "/" ? path === "/" : path.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={on ? "page" : undefined}
                className={`inline-flex items-center gap-1.5 rounded-control px-3 py-1.5 ${
                  on ? "bg-white/10 text-white" : "text-white/80 hover:bg-white/10 hover:text-white"
                }`}
              >
                {n.label}
                {n.href === "/board" && active > 0 && (
                  <span className="rounded-full bg-muesli px-1.5 text-[11px] font-semibold text-midnight">{active}</span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="brand-rule" aria-hidden="true" />
    </header>
  );
}
