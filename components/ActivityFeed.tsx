"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Activity as ActivityIcon, RefreshCw } from "lucide-react";
import { getActivity, type Activity } from "@/lib/api";

const LABEL: Record<string, string> = {
  unlocked: "Unlocked the app",
  unlock_failed: "Wrong access code entered",
  folder_created: "Created folder",
  files_added: "Added files",
  item_assigned: "Assigned to folder",
  item_unassigned: "Removed folder assignment",
  item_removed: "Removed from queue",
  item_retried: "Retried",
  queue_started: "Started sending",
  queue_paused: "Paused queue",
  wait_skipped: "Skipped learning wait",
  batch_created: "Batch opened",
  upload_sent: "Sent to Cody",
  cody_busy_retry: "Cody busy — retrying",
  upload_failed: "Upload failed",
  learning_started: "Cody started learning",
  document_learned: "Learned by Cody",
  learning_failed: "Cody couldn't learn",
  learning_timeout: "Timed out",
  batch_complete: "Batch fully learned",
  batch_partial: "Batch partly learned",
  batch_failed: "Batch failed",
  document_deleted: "Deleted document",
};

const TONE: Record<string, string> = {
  upload_failed: "bg-danger",
  learning_failed: "bg-danger",
  learning_timeout: "bg-danger",
  batch_failed: "bg-danger",
  unlock_failed: "bg-danger",
  document_deleted: "bg-danger",
  document_learned: "bg-success",
  batch_complete: "bg-success",
  upload_sent: "bg-nile",
  learning_started: "bg-muesli",
};

const time = (iso: string) =>
  new Intl.DateTimeFormat("en-PH", { dateStyle: "short", timeStyle: "medium", timeZone: "Asia/Manila" }).format(new Date(iso));

function summary(a: Activity) {
  const d = a.detail ?? {};
  if (a.action === "files_added") {
    const files = (d.files as string[] | undefined) ?? [];
    return `${files.length} file(s)${(d.folders as string[] | undefined)?.length ? ` → ${(d.folders as string[]).join(", ")}` : " (unassigned)"}`;
  }
  if (a.action === "batch_created") return `${d.items ?? "?"} item(s)`;
  if (a.action.startsWith("batch_")) return `${d.items ?? ""} item(s)`;
  const parts = [a.file_name, a.folder_name && `→ ${a.folder_name}`].filter(Boolean).join(" ");
  const err = typeof d.error === "string" ? ` · ${d.error}` : "";
  return parts + err;
}

/** Audit trail from Neon. `live` polls every 4 s for new rows. */
export function ActivityFeed({ live = false, limit = 150, compact = false }: { live?: boolean; limit?: number; compact?: boolean }) {
  const [rows, setRows] = useState<Activity[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const last = useRef(0);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const r = await getActivity(0, limit);
      setRows(r);
      last.current = r[0]?.id ?? 0;
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!live) return;
    const t = setInterval(async () => {
      const fresh = await getActivity(last.current, 100).catch(() => []);
      if (fresh.length) {
        last.current = fresh[0].id;
        setRows((all) => [...fresh, ...all].slice(0, limit));
      }
    }, 4000);
    return () => clearInterval(t);
  }, [live, limit]);

  return (
    <section aria-labelledby="act-h" className="rounded-card border border-line bg-surface shadow-card">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <ActivityIcon className="size-4 text-muesli" aria-hidden="true" />
        <h2 id="act-h" className="text-sm font-semibold">Activity log</h2>
        {live && (
          <span className="inline-flex items-center gap-1 text-xs text-success">
            <span className="size-1.5 animate-pulse rounded-full bg-success" aria-hidden="true" /> live
          </span>
        )}
        <button
          type="button"
          onClick={() => void loadAll()}
          className="ml-auto rounded-control p-1 text-muted hover:bg-canvas hover:text-text"
          aria-label="Reload activity"
        >
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
        </button>
      </div>
      {error && <p className="px-4 py-4 text-sm text-danger">{error}</p>}
      {!error && rows.length === 0 && !loading && <p className="px-4 py-8 text-center text-sm text-muted">No activity yet.</p>}
      <ol className={`divide-y divide-line overflow-y-auto ${compact ? "max-h-[60dvh]" : "max-h-[70dvh]"}`} aria-live={live ? "polite" : undefined}>
        {rows.map((a) => (
          <li key={a.id} className="flex gap-3 px-4 py-2.5">
            <span className={`mt-1.5 size-2 shrink-0 rounded-full ${TONE[a.action] ?? "bg-iron"}`} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-sm">
                <span className="font-medium">{LABEL[a.action] ?? a.action}</span>
                {summary(a) && <span className="text-muted"> · {summary(a)}</span>}
              </p>
              <p className="text-xs text-muted">
                {time(a.created_at)} · {a.source === "client" ? "user" : "system"}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
