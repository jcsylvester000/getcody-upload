"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDownUp, FileText, RefreshCw, Search } from "lucide-react";
import type { CodyDocument, CodyFolder } from "@/lib/types";
import { getDocuments } from "@/lib/api";
import { formatDate } from "@/lib/file-rules";
import { StatusBadge } from "./StatusBadge";

type Props = { folders: CodyFolder[]; selected: Set<string>; refreshKey: number };

/** Documents inside the ticked folders, with upload dates and learning status. */
export function DocumentsTab({ folders, selected, refreshKey }: Props) {
  const [docs, setDocs] = useState<CodyDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [asc, setAsc] = useState(false);
  const ids = useMemo(() => [...selected].sort(), [selected]);
  const nameOf = useMemo(() => new Map(folders.map((f) => [f.id, f.name])), [folders]);

  const load = useCallback(async () => {
    if (ids.length === 0) {
      setDocs([]);
      return;
    }
    setLoading(true);
    try {
      setDocs(await getDocuments(ids));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [ids]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  // Auto-refresh while Cody is still learning something
  const syncing = docs.some((d) => d.status === "syncing");
  useEffect(() => {
    if (!syncing) return;
    const t = setInterval(() => void load(), 15_000);
    return () => clearInterval(t);
  }, [syncing, load]);

  const shown = useMemo(() => {
    const k = q.trim().toLowerCase();
    return docs
      .filter((d) => d.name.toLowerCase().includes(k))
      .sort((a, b) => (asc ? a.created_at - b.created_at : b.created_at - a.created_at));
  }, [docs, q, asc]);

  if (ids.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-line-strong bg-surface px-6 py-16 text-center">
        <p className="font-display text-xl text-nile">Tick one or more folders</p>
        <p className="mt-1 text-sm text-muted">Their documents and upload dates will appear here.</p>
      </div>
    );
  }

  return (
    <section aria-labelledby="docs-h" className="rounded-card border border-line bg-surface shadow-card">
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
        <h2 id="docs-h" className="text-sm font-semibold">
          Documents <span className="font-normal text-muted">· {docs.length} in {ids.length} folder{ids.length > 1 ? "s" : ""}</span>
        </h2>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <label className="relative">
            <span className="sr-only">Search documents</span>
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search"
              className="w-40 rounded-control border border-line-strong py-1.5 pl-8 pr-2 text-sm placeholder:text-muted sm:w-56"
            />
          </label>
          <button
            type="button"
            onClick={() => setAsc((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-control border border-line-strong px-2.5 py-1.5 text-sm hover:bg-canvas"
          >
            <ArrowDownUp className="size-4" aria-hidden="true" />
            {asc ? "Oldest first" : "Newest first"}
          </button>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-1.5 rounded-control border border-line-strong px-2.5 py-1.5 text-sm hover:bg-canvas"
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
            Refresh
          </button>
        </div>
      </div>

      {error && <p className="px-4 py-6 text-sm text-danger" role="alert">{error}</p>}
      {!error && loading && docs.length === 0 && (
        <ul className="space-y-2 p-4" aria-busy="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <li key={i} className="h-11 animate-pulse rounded-control bg-canvas" />
          ))}
        </ul>
      )}
      {!error && !loading && shown.length === 0 && (
        <p className="px-4 py-10 text-center text-sm text-muted">{docs.length ? "Nothing matches that search." : "These folders are empty."}</p>
      )}

      {shown.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-canvas text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th scope="col" className="px-4 py-2 font-medium">Document</th>
                <th scope="col" className="px-4 py-2 font-medium">Folder</th>
                <th scope="col" className="px-4 py-2 font-medium">Uploaded</th>
                <th scope="col" className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {shown.map((d) => (
                <tr key={d.id} className="hover:bg-canvas/60">
                  <td className="px-4 py-2.5">
                    <span className="flex items-center gap-2">
                      <FileText className="size-4 shrink-0 text-nile" aria-hidden="true" />
                      {d.content_url ? (
                        <a href={d.content_url} target="_blank" rel="noreferrer" className="truncate font-medium hover:underline">
                          {d.name}
                        </a>
                      ) : (
                        <span className="truncate font-medium">{d.name}</span>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-muted">{nameOf.get(d.folder_id) ?? d.folder_id}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-muted">{formatDate(d.created_at)}</td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={d.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
