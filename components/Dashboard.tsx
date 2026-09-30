"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, CircleAlert, Clock, FolderOpen, Layers, Loader2, RefreshCw, Search, Trash2, UploadCloud } from "lucide-react";
import { getStats, type Stats } from "@/lib/api";
import { formatBytes } from "@/lib/file-rules";
import { useApp } from "./AppProvider";
import { ActivityFeed } from "./ActivityFeed";

const RANGES = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
  { days: 0, label: "All time" },
];

const n = (v: number) => new Intl.NumberFormat("en-PH").format(v);
const when = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }).format(new Date(iso)) : "—";
const dur = (s: number | null) => (s == null ? "—" : s < 90 ? `${s}s` : s < 5400 ? `${Math.round(s / 60)} min` : `${(s / 3600).toFixed(1)} h`);

/** Upload analytics from the Neon history: totals, per-folder breakdown, daily trend, file types. */
export function Dashboard() {
  const { folders: codyFolders, queue } = useApp();
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await getStats(days));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [days]);

  // Load on mount / range change, right away when a batch settles, and every 20 s.
  const settled = queue.batches.filter((b) => ["complete", "partial", "failed"].includes(b.status)).length;
  useEffect(() => {
    void load();
  }, [settled, load]);
  useEffect(() => {
    const t = setInterval(() => void load(), 20_000);
    return () => clearInterval(t);
  }, [load]);

  const nameOf = useMemo(() => new Map(codyFolders.map((f) => [f.id, f.name])), [codyFolders]);
  const t = data?.totals;
  const successRate = t && t.learned + t.failed > 0 ? Math.round((t.learned / (t.learned + t.failed)) * 100) : null;

  const folderRows = useMemo(() => {
    const k = q.trim().toLowerCase();
    return (data?.folders ?? [])
      .map((f) => ({ ...f, name: nameOf.get(f.folder_id) ?? f.folder_name ?? f.folder_id }))
      .filter((f) => f.name.toLowerCase().includes(k));
  }, [data, nameOf, q]);
  const maxFolder = Math.max(1, ...folderRows.map((f) => f.uploads));

  // Fill empty days so the chart has a continuous axis.
  const daily = useMemo(() => {
    const rows = data?.daily ?? [];
    if (!rows.length) return [];
    const map = new Map(rows.map((r) => [r.day, r]));
    const span = days || Math.min(365, Math.ceil((Date.now() - new Date(rows[0].day).getTime()) / 86_400_000) + 1);
    const out = [];
    for (let i = span - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86_400_000);
      const key = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(d); // YYYY-MM-DD
      out.push(map.get(key) ?? { day: key, uploads: 0, learned: 0, failed: 0 });
    }
    return out;
  }, [data, days]);
  const maxDay = Math.max(1, ...daily.map((d) => d.uploads));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muesli-text">Cody knowledge base</p>
          <h1 className="mt-1 font-display text-3xl text-nile">Dashboard</h1>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Date range" className="flex rounded-control border border-line-strong bg-surface p-0.5">
            {RANGES.map((r) => (
              <button
                key={r.days}
                type="button"
                aria-pressed={days === r.days}
                onClick={() => setDays(r.days)}
                className={`rounded-[6px] px-3 py-1.5 text-sm ${days === r.days ? "bg-nile font-semibold text-white" : "text-muted hover:text-text"}`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-1.5 rounded-control border border-line-strong bg-surface px-3 py-2 text-sm hover:bg-canvas"
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" /> Refresh
          </button>
          <Link href="/board" className="rounded-control bg-nile px-4 py-2 text-sm font-semibold text-white hover:bg-midnight">
            Upload files
          </Link>
        </div>
      </div>

      {error && <p className="rounded-control bg-danger-soft px-4 py-3 text-sm text-danger" role="alert">{error}</p>}

      {/* KPI cards */}
      <section aria-label="Totals" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7">
        <Kpi Icon={UploadCloud} label="Uploads" value={t ? n(t.uploads) : "…"} sub={t ? `${n(t.batches)} batches` : ""} tone="text-nile" />
        <Kpi Icon={CheckCircle2} label="Learned by Cody" value={t ? n(t.learned) : "…"} sub={successRate != null ? `${successRate}% success` : "—"} tone="text-success" />
        <Kpi Icon={Loader2} label="In progress" value={t ? n(t.in_progress) : "…"} sub="uploading / learning" tone="text-warning" />
        <Kpi Icon={CircleAlert} label="Failed" value={t ? n(t.failed) : "…"} sub="retry from the Board" tone="text-danger" />
        <Kpi Icon={FolderOpen} label="Folders used" value={t ? n(t.folders) : "…"} sub={`${n(codyFolders.length)} in Cody`} tone="text-muesli-text" />
        <Kpi Icon={Layers} label="Data learned" value={t ? formatBytes(Number(t.bytes_learned)) : "…"} sub={t ? `${n(t.deleted)} deleted` : ""} tone="text-nile" />
        <Kpi Icon={Clock} label="Avg. time to learn" value={t ? dur(t.avg_learn_seconds) : "…"} sub={t ? `last upload ${when(t.last_upload)}` : ""} tone="text-muted" />
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-6">
          {/* Daily chart */}
          <section aria-labelledby="daily-h" className="rounded-card border border-line bg-surface p-4 shadow-card">
            <div className="flex flex-wrap items-center gap-3">
              <h2 id="daily-h" className="text-sm font-semibold">Uploads per day</h2>
              <span className="flex items-center gap-3 text-xs text-muted">
                <Legend cls="bg-success" label="Learned" />
                <Legend cls="bg-nile" label="Other" />
                <Legend cls="bg-danger" label="Failed" />
              </span>
            </div>
            {daily.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted">{loading ? "Loading…" : "No uploads in this period."}</p>
            ) : (
              <div className="mt-4">
                <div className="flex h-44 items-end gap-[2px]" role="img" aria-label={`Daily uploads, max ${maxDay} per day`}>
                  {daily.map((d) => {
                    const other = d.uploads - d.learned - d.failed;
                    const h = (v: number) => `${(v / maxDay) * 100}%`;
                    return (
                      <div key={d.day} className="group relative flex h-full min-w-[3px] flex-1 flex-col justify-end" title={`${d.day}: ${d.uploads} uploads · ${d.learned} learned · ${d.failed} failed`}>
                        <div className="w-full rounded-t-[2px] bg-danger" style={{ height: h(d.failed) }} />
                        <div className="w-full bg-nile" style={{ height: h(other) }} />
                        <div className="w-full bg-success" style={{ height: h(d.learned) }} />
                      </div>
                    );
                  })}
                </div>
                <div className="mt-1.5 flex justify-between text-[11px] text-muted">
                  <span>{daily[0].day}</span>
                  <span>{daily[daily.length - 1].day}</span>
                </div>
              </div>
            )}
          </section>

          {/* By folder */}
          <section aria-labelledby="byfolder-h" className="rounded-card border border-line bg-surface shadow-card">
            <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
              <h2 id="byfolder-h" className="text-sm font-semibold">
                Uploads by folder <span className="font-normal text-muted">· {folderRows.length}</span>
              </h2>
              <label className="relative ml-auto">
                <span className="sr-only">Search folders</span>
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
                <input
                  type="search"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search folders"
                  className="w-48 rounded-control border border-line-strong py-1.5 pl-8 pr-2 text-sm placeholder:text-muted"
                />
              </label>
            </div>
            {folderRows.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted">{loading ? "Loading…" : "No uploads yet in this period."}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="bg-canvas text-left text-xs uppercase tracking-wide text-muted">
                    <tr>
                      <th scope="col" className="px-4 py-2 font-medium">Folder</th>
                      <th scope="col" className="w-[34%] px-4 py-2 font-medium">Uploads</th>
                      <th scope="col" className="px-4 py-2 text-right font-medium">Learned</th>
                      <th scope="col" className="px-4 py-2 text-right font-medium">Failed</th>
                      <th scope="col" className="px-4 py-2 text-right font-medium">Size</th>
                      <th scope="col" className="px-4 py-2 font-medium">Last upload</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {folderRows.map((f) => (
                      <tr key={f.folder_id} className="hover:bg-canvas/60">
                        <td className="max-w-[240px] px-4 py-2.5">
                          <span className="flex items-center gap-2">
                            <FolderOpen className="size-4 shrink-0 text-muesli" aria-hidden="true" />
                            <span className="truncate font-medium">{f.name}</span>
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="flex h-2.5 flex-1 overflow-hidden rounded-full bg-canvas" aria-hidden="true">
                              <div className="bg-success" style={{ width: `${(f.learned / maxFolder) * 100}%` }} />
                              <div className="bg-nile" style={{ width: `${((f.uploads - f.learned - f.failed) / maxFolder) * 100}%` }} />
                              <div className="bg-danger" style={{ width: `${(f.failed / maxFolder) * 100}%` }} />
                            </div>
                            <span className="w-10 text-right font-semibold tabular-nums">{n(f.uploads)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-success">{n(f.learned)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-danger">{f.failed ? n(f.failed) : "—"}</td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums text-muted">{formatBytes(Number(f.bytes))}</td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-muted">{when(f.last_upload)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* File types */}
          {(data?.types.length ?? 0) > 0 && (
            <section aria-labelledby="types-h" className="rounded-card border border-line bg-surface p-4 shadow-card">
              <h2 id="types-h" className="text-sm font-semibold">File types</h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {data!.types.map((x) => (
                  <li key={x.ext} className="rounded-full bg-nile-soft px-3 py-1 text-xs font-medium text-nile">
                    .{x.ext} <span className="text-muted">· {n(x.uploads)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="min-w-0">
          <ActivityFeed live compact limit={60} />
          {t && t.deleted > 0 && (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
              <Trash2 className="size-3.5" aria-hidden="true" /> {n(t.deleted)} uploaded document(s) were later deleted from Cody.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}

function Kpi({ Icon, label, value, sub, tone }: { Icon: typeof UploadCloud; label: string; value: string; sub?: string; tone: string }) {
  return (
    <div className="rounded-card border border-line bg-surface p-4 shadow-card">
      <div className="flex items-center gap-2 text-xs font-medium text-muted">
        <Icon className={`size-4 ${tone}`} aria-hidden="true" /> {label}
      </div>
      <p className={`mt-2 text-2xl font-semibold tabular-nums ${tone === "text-muted" ? "text-text" : tone}`}>{value}</p>
      {sub && <p className="mt-0.5 truncate text-xs text-muted" title={sub}>{sub}</p>}
    </div>
  );
}

function Legend({ cls, label }: { cls: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`size-2 rounded-sm ${cls}`} aria-hidden="true" /> {label}
    </span>
  );
}
