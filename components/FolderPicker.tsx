"use client";

import { useMemo, useState } from "react";
import { RefreshCw, Search } from "lucide-react";
import type { CodyFolder } from "@/lib/types";

type Props = {
  folders: CodyFolder[];
  loading: boolean;
  error: string | null;
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  onReload: () => void;
};

/** Tick-box filter of every Cody folder the API key can see. */
export function FolderPicker({ folders, loading, error, selected, onChange, onReload }: Props) {
  const [q, setQ] = useState("");
  const shown = useMemo(() => {
    const k = q.trim().toLowerCase();
    return folders.filter((f) => f.name.toLowerCase().includes(k));
  }, [folders, q]);

  const toggle = (id: string) => {
    const n = new Set(selected);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    onChange(n);
  };

  return (
    <section aria-labelledby="folders-h" className="rounded-card border border-line bg-surface shadow-card">
      <div className="border-b border-line p-4">
        <div className="flex items-center justify-between">
          <h2 id="folders-h" className="text-xs font-semibold uppercase tracking-[0.12em] text-muesli-text">
            Cody folders
          </h2>
          <button
            type="button"
            onClick={onReload}
            className="rounded-control p-1 text-muted hover:bg-canvas hover:text-text"
            aria-label="Reload folders"
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
          </button>
        </div>
        <label className="relative mt-3 block">
          <span className="sr-only">Search folders</span>
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search folders"
            className="w-full rounded-control border border-line-strong py-2 pl-8 pr-3 text-sm placeholder:text-muted"
          />
        </label>
        <div className="mt-3 flex items-center justify-between text-xs">
          <span className="text-muted">
            {selected.size} of {folders.length} selected
          </span>
          <span className="flex gap-2">
            <button type="button" className="font-medium text-nile hover:underline" onClick={() => onChange(new Set([...selected, ...shown.map((f) => f.id)]))}>
              Select all
            </button>
            <button type="button" className="font-medium text-muted hover:underline" onClick={() => onChange(new Set())}>
              Clear
            </button>
          </span>
        </div>
      </div>

      <div className="max-h-72 overflow-y-auto p-2 lg:max-h-[calc(100dvh-300px)]">
        {loading && folders.length === 0 && (
          <ul className="space-y-1" aria-busy="true" aria-label="Loading folders">
            {Array.from({ length: 6 }).map((_, i) => (
              <li key={i} className="h-9 animate-pulse rounded-control bg-canvas" />
            ))}
          </ul>
        )}
        {error && (
          <p className="p-3 text-sm text-danger" role="alert">
            {error}
          </p>
        )}
        {!loading && !error && shown.length === 0 && <p className="p-3 text-sm text-muted">No folders found.</p>}
        <ul className="space-y-0.5">
          {shown.map((f) => {
            const on = selected.has(f.id);
            return (
              <li key={f.id}>
                <label
                  className={`flex cursor-pointer items-center gap-3 rounded-control px-3 py-2 text-sm ${
                    on ? "bg-nile-soft font-medium text-nile" : "hover:bg-canvas"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => toggle(f.id)}
                    className="size-4 shrink-0 accent-[var(--color-nile)]"
                  />
                  <span className="truncate">{f.name}</span>
                </label>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
