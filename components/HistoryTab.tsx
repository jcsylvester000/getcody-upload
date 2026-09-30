"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import type { UploadLog } from "@/lib/types";
import { getHistory } from "@/lib/api";
import { formatBytes } from "@/lib/file-rules";
import { StatusBadge } from "./StatusBadge";

const fmt = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }).format(new Date(iso))
    : "—";

/** Upload history stored in Neon: which files went to which folders, and whether Cody learned them. */
export function HistoryTab({ selected, refreshKey }: { selected: Set<string>; refreshKey: number }) {
  const [rows, setRows] = useState<UploadLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [onlySelected, setOnlySelected] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await getHistory(500));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const shown = useMemo(
    () => (onlySelected ? rows.filter((r) => selected.has(r.folder_id)) : rows),
    [rows, onlySelected, selected],
  );

  return (
    <section aria-labelledby="hist-h" className="rounded-card border border-line bg-surface shadow-card">
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
        <h2 id="hist-h" className="text-sm font-semibold">
          Upload history <span className="font-normal text-muted">· {shown.length} records</span>
        </h2>
        <div className="ml-auto flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-muted">
            <input type="checkbox" checked={onlySelected} onChange={(e) => setOnlySelected(e.target.checked)} className="size-4 accent-[var(--color-nile)]" />
            Only ticked folders
          </label>
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
      {!error && !loading && shown.length === 0 && <p className="px-4 py-10 text-center text-sm text-muted">No uploads recorded yet.</p>}
      {shown.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-canvas text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th scope="col" className="px-4 py-2 font-medium">Sent</th>
                <th scope="col" className="px-4 py-2 font-medium">File</th>
                <th scope="col" className="px-4 py-2 font-medium">Folder</th>
                <th scope="col" className="px-4 py-2 font-medium">Size</th>
                <th scope="col" className="px-4 py-2 font-medium">Status</th>
                <th scope="col" className="px-4 py-2 font-medium">Learned</th>
                <th scope="col" className="px-4 py-2 font-medium">Batch</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {shown.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap px-4 py-2.5 text-muted">{fmt(r.sent_at ?? r.created_at)}</td>
                  <td className="max-w-[260px] px-4 py-2.5">
                    <p className="truncate font-medium">{r.file_name}</p>
                    {r.error && <p className="truncate text-xs text-danger">{r.error}</p>}
                  </td>
                  <td className="px-4 py-2.5 text-muted">{r.folder_name ?? r.folder_id}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-muted">{formatBytes(Number(r.file_size))}</td>
                  <td className="px-4 py-2.5"><StatusBadge status={r.status} /></td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-muted">{fmt(r.learned_at)}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted">{r.batch_id.slice(0, 8)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
