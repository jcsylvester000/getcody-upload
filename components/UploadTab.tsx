"use client";

import { useRef, useState } from "react";
import { Eye, FileText, FolderOpen, Pause, Play, RotateCcw, SkipForward, Trash2, UploadCloud, X } from "lucide-react";
import type { CodyFolder, QueueItem } from "@/lib/types";
import { ACCEPT_ATTR, ALLOWED_EXTENSIONS, formatBytes, validateFile } from "@/lib/file-rules";
import { BATCH_SIZE, type UploadQueue as Queue } from "@/hooks/useUploadQueue";
import { FilePreview } from "./FilePreview";
import { StatusBadge } from "./StatusBadge";

type Staged = { id: string; file: File; error: string | null };

const uid = () => Math.random().toString(36).slice(2, 10);

export function UploadTab({ targets, queue }: { targets: CodyFolder[]; queue: Queue }) {
  const [staged, setStaged] = useState<Staged[]>([]);
  const [preview, setPreview] = useState<File | null>(null);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const add = (list: FileList | null) => {
    if (!list) return;
    setStaged((s) => [...s, ...Array.from(list).map((file) => ({ id: uid(), file, error: validateFile(file) }))]);
  };
  const valid = staged.filter((s) => !s.error);
  const total = valid.length * targets.length;

  const toQueue = () => {
    if (!total) return;
    queue.enqueue(valid, targets);
    setStaged((s) => s.filter((x) => x.error));
  };

  return (
    <div className="space-y-6">
      {/* 1. Choose files */}
      <section aria-labelledby="stage-h" className="rounded-card border border-line bg-surface shadow-card">
        <div className="border-b border-line px-4 py-3">
          <h2 id="stage-h" className="text-sm font-semibold">1 · Choose documents and preview them</h2>
        </div>
        <div className="p-4">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setOver(false);
              add(e.dataTransfer.files);
            }}
            className={`rounded-card border-2 border-dashed px-6 py-8 text-center transition-colors ${
              over ? "border-nile bg-nile-soft" : "border-line-strong hover:border-nile"
            }`}
          >
            <UploadCloud className="mx-auto size-8 text-muesli" aria-hidden="true" />
            <p className="mt-2 text-sm font-semibold">Drag documents here</p>
            <button
              type="button"
              onClick={() => input.current?.click()}
              className="mt-3 rounded-control border border-nile px-4 py-2 text-sm font-semibold text-nile hover:bg-nile-soft"
            >
              Browse files
            </button>
            <input
              ref={input}
              type="file"
              multiple
              accept={ACCEPT_ATTR}
              className="sr-only"
              tabIndex={-1}
              onChange={(e) => {
                add(e.target.files);
                e.target.value = "";
              }}
            />
            <p className="mt-3 text-xs text-muted">
              {ALLOWED_EXTENSIONS.map((e) => e.toUpperCase()).join(" · ")} — up to 100 MB each
            </p>
          </div>

          {staged.length > 0 && (
            <ul className="mt-4 divide-y divide-line rounded-control border border-line">
              {staged.map((s) => (
                <li key={s.id} className="flex items-center gap-3 px-3 py-2.5">
                  <FileText className="size-5 shrink-0 text-nile" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{s.file.name}</p>
                    <p className={`text-xs ${s.error ? "text-danger" : "text-muted"}`}>{s.error ?? formatBytes(s.file.size)}</p>
                  </div>
                  {!s.error && (
                    <button
                      type="button"
                      onClick={() => setPreview(s.file)}
                      className="inline-flex items-center gap-1 rounded-control px-2 py-1 text-xs font-medium text-nile hover:bg-nile-soft"
                    >
                      <Eye className="size-4" aria-hidden="true" /> Preview
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setStaged((x) => x.filter((y) => y.id !== s.id))}
                    className="rounded-control p-1 text-muted hover:bg-canvas hover:text-text"
                    aria-label={`Remove ${s.file.name}`}
                  >
                    <X className="size-4" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* 2. Targets */}
      <section aria-labelledby="target-h" className="rounded-card border border-line bg-surface p-4 shadow-card">
        <h2 id="target-h" className="text-sm font-semibold">2 · Destination folders</h2>
        {targets.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Tick one or more folders on the left.</p>
        ) : (
          <ul className="mt-3 flex flex-wrap gap-2">
            {targets.map((f) => (
              <li key={f.id} className="inline-flex items-center gap-1.5 rounded-full bg-nile-soft px-3 py-1 text-xs font-medium text-nile">
                <FolderOpen className="size-3.5" aria-hidden="true" />
                {f.name}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={!total}
            onClick={toQueue}
            className="rounded-control bg-nile px-4 py-2.5 text-sm font-semibold text-white hover:bg-midnight disabled:cursor-not-allowed disabled:bg-iron disabled:text-muted"
          >
            Add {total || ""} upload{total === 1 ? "" : "s"} to queue
          </button>
          {total > 0 && (
            <span className="text-xs text-muted">
              {valid.length} file{valid.length > 1 ? "s" : ""} × {targets.length} folder{targets.length > 1 ? "s" : ""}
            </span>
          )}
        </div>
      </section>

      {/* 3. Queue */}
      <QueuePanel queue={queue} onPreview={(id) => setPreview(queue.fileFor(id) ?? null)} />

      {preview && <FilePreview file={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}

function QueuePanel({ queue, onPreview }: { queue: Queue; onPreview: (fileId: string) => void }) {
  const { items, batches, running, notice } = queue;
  const waiting = items.filter((x) => x.status === "queued" && !x.logId);
  const nextBatches = Math.ceil(waiting.length / BATCH_SIZE);

  // Group: sent batches (newest first), then planned batches of 10.
  const groups: { title: string; status?: string; list: QueueItem[] }[] = [];
  [...batches].reverse().forEach((b) => {
    const list = items.filter((x) => x.batchNo === b.no);
    if (list.length) groups.push({ title: `Batch ${b.no}`, status: b.status, list });
  }
  );
  for (let i = 0; i < nextBatches; i++) {
    groups.push({
      title: `Up next · batch ${batches.length + i + 1}`,
      list: waiting.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE),
    });
  }

  return (
    <section aria-labelledby="queue-h" className="rounded-card border border-line bg-surface shadow-card">
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
        <h2 id="queue-h" className="text-sm font-semibold">
          3 · Queue <span className="font-normal text-muted">· {waiting.length} waiting · max {BATCH_SIZE} per batch</span>
        </h2>
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
          {running ? (
            <>
              <button type="button" onClick={queue.skipWait} className="inline-flex items-center gap-1.5 rounded-control border border-line-strong px-2.5 py-1.5 text-sm hover:bg-canvas">
                <SkipForward className="size-4" aria-hidden="true" /> Skip wait
              </button>
              <button type="button" onClick={queue.pause} className="inline-flex items-center gap-1.5 rounded-control border border-line-strong px-2.5 py-1.5 text-sm hover:bg-canvas">
                <Pause className="size-4" aria-hidden="true" /> Pause after this file
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={waiting.length === 0}
              onClick={() => void queue.start()}
              className="inline-flex items-center gap-1.5 rounded-control bg-nile px-3 py-1.5 text-sm font-semibold text-white hover:bg-midnight disabled:cursor-not-allowed disabled:bg-iron disabled:text-muted"
            >
              <Play className="size-4" aria-hidden="true" /> Start sending
            </button>
          )}
          <button type="button" onClick={queue.clearFinished} className="inline-flex items-center gap-1.5 rounded-control px-2.5 py-1.5 text-sm text-muted hover:bg-canvas">
            <Trash2 className="size-4" aria-hidden="true" /> Clear finished
          </button>
        </div>
      </div>

      {queue.resumeNeeded && !running && (
        <p className="border-b border-line bg-nile-soft px-4 py-2 text-xs text-nile" role="status">
          The page was refreshed while the queue was running. Your cards were kept — press <strong>Start sending</strong> to resume.
        </p>
      )}
      {items.some((x) => x.status === "unassigned") && (
        <p className="border-b border-line px-4 py-2 text-xs text-muted">
          {items.filter((x) => x.status === "unassigned").length} file(s) have no folder yet — assign them on the Board.
        </p>
      )}
      {notice && (
        <p className="border-b border-line bg-warning-soft px-4 py-2 text-xs text-warning" role="status" aria-live="polite">
          {notice}
        </p>
      )}

      {groups.length === 0 && <p className="px-4 py-10 text-center text-sm text-muted">The queue is empty.</p>}

      <div className="divide-y divide-line">
        {groups.map((g) => (
          <div key={g.title}>
            <div className="flex items-center gap-2 bg-canvas px-4 py-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muesli-text">{g.title}</p>
              <span className="text-xs text-muted">({g.list.length})</span>
              {g.status && <StatusBadge status={g.status} />}
            </div>
            <ul className="divide-y divide-line" aria-live="polite">
              {g.list.map((it) => (
                <li key={it.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
                  <FileText className="size-4 shrink-0 text-nile" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{it.fileName}</p>
                    <p className="truncate text-xs text-muted">
                      → {it.folderName} · {formatBytes(it.size)}
                      {it.error && <span className="text-danger"> · {it.error}</span>}
                    </p>
                    {it.status === "uploading" && (
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-canvas" role="progressbar" aria-valuenow={it.progress} aria-valuemin={0} aria-valuemax={100} aria-label={`Upload progress ${it.fileName}`}>
                        <div className="h-full rounded-full bg-nile transition-[width]" style={{ width: `${Math.max(it.progress, 3)}%` }} />
                      </div>
                    )}
                  </div>
                  <StatusBadge status={it.status} />
                  <button type="button" onClick={() => onPreview(it.fileId)} className="rounded-control p-1 text-muted hover:bg-canvas hover:text-text" aria-label={`Preview ${it.fileName}`}>
                    <Eye className="size-4" aria-hidden="true" />
                  </button>
                  {(it.status === "error" || it.status === "timeout" || it.status === "sync_failed") && (
                    <button type="button" onClick={() => queue.retry(it.id)} className="rounded-control p-1 text-muted hover:bg-canvas hover:text-text" aria-label={`Retry ${it.fileName}`}>
                      <RotateCcw className="size-4" aria-hidden="true" />
                    </button>
                  )}
                  {(!it.logId || ["synced", "sync_failed", "error", "timeout"].includes(it.status)) && (
                    <button type="button" onClick={() => queue.remove(it.id)} className="rounded-control p-1 text-muted hover:bg-canvas hover:text-text" aria-label={`Remove ${it.fileName} from queue`}>
                      <X className="size-4" aria-hidden="true" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
