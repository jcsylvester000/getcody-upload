"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  CircleAlert,
  Copy,
  Eye,
  FileText,
  FolderOpen,
  Inbox,
  Loader2,
  Pause,
  Play,
  Plus,
  RotateCcw,
  SkipForward,
  Trash2,
  Undo2,
  UploadCloud,
  X,
} from "lucide-react";
import type { CodyFolder, QueueItem, UploadLog } from "@/lib/types";
import { ACCEPT_ATTR, formatBytes, validateFile } from "@/lib/file-rules";
import { getBatch, getHistory } from "@/lib/api";
import { BATCH_SIZE } from "@/hooks/useUploadQueue";
import { useApp } from "./AppProvider";
import { FilePreview } from "./FilePreview";
import { ActivityFeed } from "./ActivityFeed";

type ColId = "inbox" | "queued" | "sending" | "converting" | "learning" | "learned" | "failed";

const COLUMNS: { id: ColId; title: string; hint: string; Icon: typeof Inbox; accent: string }[] = [
  { id: "inbox", title: "Inbox", hint: "Add files, pick a folder", Icon: Inbox, accent: "bg-iron" },
  { id: "queued", title: "Queued", hint: `Sent ${BATCH_SIZE} at a time`, Icon: FolderOpen, accent: "bg-nile" },
  { id: "sending", title: "Uploading", hint: "Going to Cody", Icon: UploadCloud, accent: "bg-nile" },
  { id: "converting", title: "Converting", hint: "Cody is reading the file", Icon: Loader2, accent: "bg-muesli" },
  { id: "learning", title: "Learning", hint: "Cody is training on it", Icon: Loader2, accent: "bg-burly" },
  { id: "learned", title: "Learned", hint: "Ready in Cody", Icon: CheckCircle2, accent: "bg-success" },
  { id: "failed", title: "Needs attention", hint: "Retry or remove", Icon: CircleAlert, accent: "bg-danger" },
];

const colOf = (s: string): ColId =>
  s === "unassigned"
    ? "inbox"
    : s === "queued"
      ? "queued"
      : s === "uploading"
        ? "sending"
        : s === "uploaded"
          ? "converting"
          : s === "syncing"
            ? "learning"
            : s === "synced"
              ? "learned"
              : "failed";

type Card =
  | { kind: "local"; item: QueueItem }
  | { kind: "remote"; log: UploadLog };

const ago = (ms: number) => {
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  return `${Math.round(s / 3600)}h ago`;
};

export function KanbanBoard() {
  const { folders, queue } = useApp();
  const [preview, setPreview] = useState<File | null>(null);
  const [remote, setRemote] = useState<UploadLog[]>([]);
  const [dragOver, setDragOver] = useState<ColId | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [bulkFolder, setBulkFolder] = useState("");
  const [, tick] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const folderById = useMemo(() => new Map(folders.map((f) => [f.id, f])), [folders]);

  // Live: history from Neon (all sessions) every 5 s; nudge Cody status for batches this tab isn't tracking.
  useEffect(() => {
    let alive = true;
    let lastNudge = 0;
    const load = async () => {
      const rows = await getHistory(150).catch(() => null);
      if (!alive || !rows) return;
      setRemote(rows.filter((r) => !r.deleted_at));
      if (Date.now() - lastNudge > 15_000) {
        lastNudge = Date.now();
        const localBatchIds = new Set(queue.batches.map((b) => b.id));
        const open = [...new Set(rows.filter((r) => r.status === "uploaded" || r.status === "syncing").map((r) => r.batch_id))];
        for (const id of open.filter((b) => !localBatchIds.has(b)).slice(0, 3)) await getBatch(id).catch(() => {});
      }
    };
    void load();
    const t = setInterval(load, 5000);
    const clock = setInterval(() => tick((n) => n + 1), 15_000);
    return () => {
      alive = false;
      clearInterval(t);
      clearInterval(clock);
    };
  }, [queue.batches]);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 4000);
    return () => clearTimeout(t);
  }, [flash]);

  // Build columns: local cards first, then cards from other sessions / earlier (history), last 48 h.
  const cards = useMemo(() => {
    const map: Record<ColId, Card[]> = { inbox: [], queued: [], sending: [], converting: [], learning: [], learned: [], failed: [] };
    const localLogIds = new Set(queue.items.map((i) => i.logId).filter(Boolean));
    for (const item of queue.items) map[colOf(item.status)].push({ kind: "local", item });
    const cutoff = Date.now() - 48 * 3600_000;
    for (const log of remote) {
      if (localLogIds.has(log.id) || new Date(log.created_at).getTime() < cutoff) continue;
      if (log.status === "queued") continue; // not really in flight
      map[colOf(log.status)].push({ kind: "remote", log });
    }
    return map;
  }, [queue.items, remote]);

  const waiting = queue.items.filter((x) => x.status === "queued" && !x.logId);
  const batchOf = (id: string) => Math.floor(waiting.findIndex((x) => x.id === id) / BATCH_SIZE) + 1;

  const addFiles = (list: FileList | null) => {
    if (!list?.length) return;
    const ok: File[] = [];
    const bad: string[] = [];
    for (const f of Array.from(list)) {
      const err = validateFile(f);
      if (err) bad.push(`${f.name}: ${err}`);
      else ok.push(f);
    }
    if (ok.length) queue.addFiles(ok);
    if (bad.length) setFlash(bad.join(" · "));
  };

  const onDrop = (col: ColId, e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(null);
    if (e.dataTransfer.files?.length) {
      if (col === "inbox" || col === "queued") addFiles(e.dataTransfer.files);
      return;
    }
    const id = e.dataTransfer.getData("text/card");
    const it = queue.items.find((x) => x.id === id);
    if (!it) return;
    if (col === "queued" && it.status === "unassigned") {
      if (!it.folderId) setFlash(`Pick a folder for “${it.fileName}” first.`);
    } else if (col === "inbox" && it.status === "queued" && !it.logId) {
      queue.unassign(id);
    }
  };

  const bulkAssign = () => {
    const f = folderById.get(bulkFolder);
    if (!f) return;
    cards.inbox.forEach((c) => c.kind === "local" && queue.assign(c.item.id, f));
    setBulkFolder("");
  };

  const counts = Object.fromEntries(COLUMNS.map((c) => [c.id, cards[c.id].length])) as Record<ColId, number>;

  return (
    <div className="space-y-5">
      {/* Header + controls */}
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muesli-text">Live upload tracking</p>
          <h1 className="mt-1 font-display text-3xl text-nile">Upload board</h1>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-muted">
            <input
              type="checkbox"
              checked={queue.waitForLearning}
              onChange={(e) => queue.setWaitForLearning(e.target.checked)}
              className="size-4 accent-[var(--color-nile)]"
            />
            Wait until learned before next batch
          </label>
          {queue.running ? (
            <>
              <button type="button" onClick={queue.skipWait} className="inline-flex items-center gap-1.5 rounded-control border border-line-strong bg-surface px-3 py-2 text-sm hover:bg-canvas">
                <SkipForward className="size-4" aria-hidden="true" /> Skip wait
              </button>
              <button type="button" onClick={queue.pause} className="inline-flex items-center gap-1.5 rounded-control border border-line-strong bg-surface px-3 py-2 text-sm hover:bg-canvas">
                <Pause className="size-4" aria-hidden="true" /> Pause
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={waiting.length === 0}
              onClick={() => void queue.start()}
              className="inline-flex items-center gap-1.5 rounded-control bg-nile px-4 py-2 text-sm font-semibold text-white hover:bg-midnight disabled:cursor-not-allowed disabled:bg-iron disabled:text-muted"
            >
              <Play className="size-4" aria-hidden="true" /> Start sending{waiting.length ? ` (${waiting.length})` : ""}
            </button>
          )}
          <button type="button" onClick={queue.clearFinished} className="inline-flex items-center gap-1.5 rounded-control px-3 py-2 text-sm text-muted hover:bg-surface">
            <Trash2 className="size-4" aria-hidden="true" /> Clear finished
          </button>
        </div>
      </div>

      {(queue.notice || flash || (queue.resumeNeeded && !queue.running)) && (
        <p
          className={`rounded-control px-4 py-2 text-sm ${flash ? "bg-danger-soft text-danger" : "bg-warning-soft text-warning"}`}
          role="status"
          aria-live="polite"
        >
          {flash ?? queue.notice ?? "The page was refreshed while sending. Your cards were kept — press Start sending to resume."}
        </p>
      )}

      {/* Board */}
      <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6">
        <div className="grid min-w-[1820px] grid-cols-7 gap-3">
          {COLUMNS.map((col) => (
            <section
              key={col.id}
              aria-labelledby={`col-${col.id}`}
              onDragOver={(e) => {
                if (col.id === "inbox" || col.id === "queued") {
                  e.preventDefault();
                  setDragOver(col.id);
                }
              }}
              onDragLeave={() => setDragOver(null)}
              onDrop={(e) => onDrop(col.id, e)}
              className={`flex max-h-[calc(100dvh-260px)] min-h-[420px] flex-col rounded-card border bg-canvas transition-colors ${
                dragOver === col.id ? "border-nile bg-nile-soft" : "border-line"
              }`}
            >
              <header className="rounded-t-card border-b border-line bg-surface px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className={`size-2 rounded-full ${col.accent}`} aria-hidden="true" />
                  <h2 id={`col-${col.id}`} className="text-sm font-semibold">{col.title}</h2>
                  <span className="ml-auto rounded-full bg-canvas px-2 text-xs font-medium text-muted">{counts[col.id]}</span>
                </div>
                <p className="mt-0.5 text-[11px] text-muted">{col.hint}</p>
              </header>

              {col.id === "inbox" && (
                <div className="space-y-2 border-b border-line p-2">
                  <button
                    type="button"
                    onClick={() => input.current?.click()}
                    className="flex w-full items-center justify-center gap-1.5 rounded-control border-2 border-dashed border-line-strong bg-surface px-3 py-3 text-sm font-medium text-nile hover:border-nile"
                  >
                    <Plus className="size-4" aria-hidden="true" /> Add files
                  </button>
                  <input
                    ref={input}
                    type="file"
                    multiple
                    accept={ACCEPT_ATTR}
                    className="sr-only"
                    tabIndex={-1}
                    onChange={(e) => {
                      addFiles(e.target.files);
                      e.target.value = "";
                    }}
                  />
                  {counts.inbox > 1 && (
                    <div className="flex gap-1">
                      <label htmlFor="bulk-folder" className="sr-only">Assign all inbox files to folder</label>
                      <select
                        id="bulk-folder"
                        value={bulkFolder}
                        onChange={(e) => setBulkFolder(e.target.value)}
                        className="min-w-0 flex-1 rounded-control border border-line-strong bg-surface px-2 py-1.5 text-xs"
                      >
                        <option value="">Assign all to…</option>
                        {folders.map((f) => (
                          <option key={f.id} value={f.id}>{f.name}</option>
                        ))}
                      </select>
                      <button type="button" disabled={!bulkFolder} onClick={bulkAssign} className="rounded-control bg-nile px-2 text-xs font-semibold text-white disabled:bg-iron">
                        Go
                      </button>
                    </div>
                  )}
                </div>
              )}

              <ol className="flex-1 space-y-2 overflow-y-auto p-2">
                {cards[col.id].length === 0 && (
                  <li className="px-2 py-6 text-center text-xs text-muted">
                    {col.id === "inbox" ? "Drop files here" : col.id === "queued" ? "Drag cards here once they have a folder" : "—"}
                  </li>
                )}
                {cards[col.id].map((c) =>
                  c.kind === "local" ? (
                    <LocalCard
                      key={c.item.id}
                      item={c.item}
                      col={col.id}
                      folders={folders}
                      batchNo={col.id === "queued" && !c.item.logId ? batchOf(c.item.id) : c.item.batchNo}
                      onPreview={() => {
                        const f = queue.fileFor(c.item.fileId);
                        if (f) setPreview(f);
                        else setFlash("This file is no longer stored in this browser.");
                      }}
                    />
                  ) : (
                    <RemoteCard key={c.log.id} log={c.log} />
                  ),
                )}
              </ol>
            </section>
          ))}
        </div>
      </div>

      <ActivityFeed live compact limit={100} />

      {preview && <FilePreview file={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}

function RemoteCard({ log }: { log: UploadLog }) {
  return (
    <li className="rounded-control border border-dashed border-line-strong bg-surface/70 p-2.5">
      <div className="flex items-start gap-2">
        <FileText className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium" title={log.file_name}>{log.file_name}</p>
          <p className="text-[11px] text-muted">
            {formatBytes(Number(log.file_size))} · {ago(new Date(log.sent_at ?? log.created_at).getTime())} · from history
          </p>
        </div>
      </div>
      <p className="mt-1.5 inline-flex max-w-full items-center gap-1 rounded-full bg-canvas px-2 py-0.5 text-[11px] text-muted">
        <FolderOpen className="size-3 shrink-0" aria-hidden="true" />
        <span className="truncate">{log.folder_name ?? log.folder_id}</span>
      </p>
      {log.error && <p className="mt-1.5 text-[11px] text-danger">{log.error}</p>}
    </li>
  );
}

function LocalCard({
  item,
  col,
  folders,
  batchNo,
  onPreview,
}: {
  item: QueueItem;
  col: ColId;
  folders: CodyFolder[];
  batchNo?: number;
  onPreview: () => void;
}) {
  const { queue } = useApp();
  const draggable = (col === "inbox" || col === "queued") && !item.logId;
  const canRemove = !item.logId || ["synced", "sync_failed", "error", "timeout"].includes(item.status);
  return (
    <li
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/card", item.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      className={`rounded-control border border-line bg-surface p-2.5 shadow-card ${draggable ? "cursor-grab active:cursor-grabbing" : ""}`}
    >
      <div className="flex items-start gap-2">
        <FileText className="mt-0.5 size-4 shrink-0 text-nile" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium" title={item.fileName}>{item.fileName}</p>
          <p className="text-[11px] text-muted">
            {formatBytes(item.size)}
            {batchNo ? ` · batch ${batchNo}` : ""} · {ago(item.addedAt)}
          </p>
        </div>
        <button type="button" onClick={onPreview} className="rounded-control p-1 text-muted hover:bg-canvas hover:text-text" aria-label={`Preview ${item.fileName}`}>
          <Eye className="size-3.5" aria-hidden="true" />
        </button>
        {canRemove && (
          <button type="button" onClick={() => queue.remove(item.id)} className="rounded-control p-1 text-muted hover:bg-canvas hover:text-danger" aria-label={`Remove ${item.fileName}`}>
            <X className="size-3.5" aria-hidden="true" />
          </button>
        )}
      </div>

      {col === "inbox" ? (
        <div className="mt-2">
          <label className="sr-only" htmlFor={`f-${item.id}`}>Folder for {item.fileName}</label>
          <select
            id={`f-${item.id}`}
            value=""
            onChange={(e) => {
              const f = folders.find((x) => x.id === e.target.value);
              if (f) queue.assign(item.id, f);
            }}
            className="w-full rounded-control border border-line-strong bg-surface px-2 py-1.5 text-xs"
          >
            <option value="">Choose folder…</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </div>
      ) : (
        <p className="mt-1.5 inline-flex max-w-full items-center gap-1 rounded-full bg-nile-soft px-2 py-0.5 text-[11px] font-medium text-nile">
          <FolderOpen className="size-3 shrink-0" aria-hidden="true" />
          <span className="truncate">{item.folderName}</span>
        </p>
      )}

      {col === "sending" && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-canvas" role="progressbar" aria-valuenow={item.progress} aria-valuemin={0} aria-valuemax={100} aria-label={`Upload progress ${item.fileName}`}>
          <div className="h-full rounded-full bg-nile transition-[width]" style={{ width: `${Math.max(item.progress, 3)}%` }} />
        </div>
      )}
      {(col === "converting" || col === "learning") && (
        <p className="mt-1.5 flex items-center gap-1 text-[11px] text-muted">
          <Loader2 className="size-3 animate-spin" aria-hidden="true" /> checking every 5 s
        </p>
      )}
      {item.error && <p className="mt-1.5 text-[11px] text-danger">{item.error}</p>}

      {col === "queued" && !item.logId && (
        <div className="mt-2 flex gap-1">
          <button type="button" onClick={() => queue.unassign(item.id)} className="inline-flex items-center gap-1 rounded-control px-1.5 py-1 text-[11px] text-muted hover:bg-canvas">
            <Undo2 className="size-3" aria-hidden="true" /> Back to inbox
          </button>
          <CopyTo item={item} />
        </div>
      )}
      {col === "learned" && <CopyTo item={item} />}
      {col === "failed" && (
        <button type="button" onClick={() => queue.retry(item.id)} className="mt-2 inline-flex items-center gap-1 rounded-control border border-line-strong px-2 py-1 text-[11px] font-medium hover:bg-canvas">
          <RotateCcw className="size-3" aria-hidden="true" /> Retry
        </button>
      )}
    </li>
  );
}

function CopyTo({ item }: { item: QueueItem }) {
  const { queue, folders } = useApp();
  const folderById = new Map(folders.map((f) => [f.id, f]));
  return (
    <label className="relative inline-flex items-center gap-1 rounded-control px-1.5 py-1 text-[11px] text-muted hover:bg-canvas">
      <Copy className="size-3" aria-hidden="true" /> Also send to…
      <select
        value=""
        onChange={(e) => {
          const f = folderById.get(e.target.value);
          if (f) queue.duplicateTo(item.id, f);
        }}
        className="absolute inset-0 cursor-pointer opacity-0"
        aria-label={`Also send ${item.fileName} to another folder`}
      >
        <option value="">Choose folder…</option>
        {folders.filter((f) => f.id !== item.folderId).map((f) => (
          <option key={f.id} value={f.id}>{f.name}</option>
        ))}
      </select>
    </label>
  );
}
