"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FINAL_STATUSES, type BatchStatus, type CodyFolder, type LogStatus, type QueueItem } from "@/lib/types";
import { contentTypeFor } from "@/lib/file-rules";
import { createBatch, getBatch, uploadOne } from "@/lib/api";

export const BATCH_SIZE = 10; // Cody limit: 10 documents per batch
const POLL_MS = 10_000;

export type BatchRun = { no: number; id: string; status: BatchStatus; itemIds: string[]; startedAt: number };

const uid = () => Math.random().toString(36).slice(2, 10);

/**
 * Client queue: every (file × folder) pair waits here until sent.
 * Runner takes ≤10 items → opens a batch (logged in Neon) → uploads them one by one →
 * polls Cody until every document is learned (or failed) → only then starts the next batch.
 */
export function useUploadQueue() {
  const files = useRef(new Map<string, File>());
  const [items, _setItems] = useState<QueueItem[]>([]);
  const itemsRef = useRef<QueueItem[]>([]);
  const setItems = useCallback((fn: (prev: QueueItem[]) => QueueItem[]) => {
    itemsRef.current = fn(itemsRef.current);
    _setItems(itemsRef.current);
  }, []);
  const patch = useCallback(
    (id: string, p: Partial<QueueItem>) => setItems((all) => all.map((x) => (x.id === id ? { ...x, ...p } : x))),
    [setItems],
  );

  const [batches, setBatches] = useState<BatchRun[]>([]);
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [waitForLearning, setWaitForLearning] = useState(true);
  const pauseRef = useRef(false);
  const skipWaitRef = useRef(false);
  const waitRef = useRef(true);
  waitRef.current = waitForLearning;

  /** Queue every file for every selected folder. */
  const enqueue = useCallback(
    (staged: { id: string; file: File }[], folders: CodyFolder[]) => {
      const add: QueueItem[] = [];
      for (const s of staged) {
        files.current.set(s.id, s.file);
        for (const f of folders) {
          add.push({
            id: uid(),
            fileId: s.id,
            fileName: s.file.name,
            size: s.file.size,
            contentType: contentTypeFor(s.file),
            folderId: f.id,
            folderName: f.name,
            status: "queued",
            progress: 0,
          });
        }
      }
      setItems((all) => [...all, ...add]);
      return add.length;
    },
    [setItems],
  );

  const remove = useCallback((id: string) => setItems((all) => all.filter((x) => x.id !== id || x.logId)), [setItems]);
  const clearFinished = useCallback(
    () => setItems((all) => all.filter((x) => !FINAL_STATUSES.includes(x.status))),
    [setItems],
  );

  const start = useCallback(async () => {
    if (running) return;
    setRunning(true);
    pauseRef.current = false;
    let batchNo = batches.length;
    try {
      while (!pauseRef.current) {
        const next = itemsRef.current.filter((x) => x.status === "queued" && !x.logId).slice(0, BATCH_SIZE);
        if (next.length === 0) break;
        batchNo += 1;

        // 1) Open batch + history rows in Neon
        const res = await createBatch(
          next.map((x) => ({
            client_id: x.id,
            file_name: x.fileName,
            file_size: x.size,
            content_type: x.contentType,
            folder_id: x.folderId,
            folder_name: x.folderName,
          })),
        );
        const logByClient = new Map(res.logs.map((l) => [l.client_id, l.log_id]));
        next.forEach((x) => patch(x.id, { logId: logByClient.get(x.id), batchNo }));
        const run: BatchRun = { no: batchNo, id: res.batch_id, status: "sending", itemIds: next.map((x) => x.id), startedAt: Date.now() };
        setBatches((b) => [...b, run]);

        // 2) Send items one at a time
        for (const x of next) {
          const file = files.current.get(x.fileId);
          const logId = logByClient.get(x.id)!;
          if (!file) {
            patch(x.id, { status: "error", error: "File no longer in memory (page was reloaded)." });
            continue;
          }
          patch(x.id, { status: "uploading", progress: 0 });
          try {
            await uploadOne(file, logId, x.contentType, (progress) => patch(x.id, { progress }), setNotice);
            patch(x.id, { status: "uploaded", progress: 100 });
          } catch (e) {
            patch(x.id, { status: "error", error: (e as Error).message });
          }
        }

        // 3) Wait until Cody has learned the whole batch before the next one
        setBatches((b) => b.map((r) => (r.id === run.id ? { ...r, status: "learning" } : r)));
        skipWaitRef.current = false;
        for (;;) {
          const { batch, logs } = await getBatch(run.id).catch(() => ({ batch: null, logs: [] }));
          for (const l of logs) {
            const it = itemsRef.current.find((i) => i.logId === l.id);
            if (it && it.status !== l.status) patch(it.id, { status: l.status as LogStatus, error: l.error ?? undefined });
          }
          if (batch) setBatches((b) => b.map((r) => (r.id === run.id ? { ...r, status: batch.status } : r)));
          const settled = batch && ["complete", "partial", "failed"].includes(batch.status);
          if (settled || !waitRef.current || skipWaitRef.current || pauseRef.current) break;
          setNotice(`Batch ${batchNo}: waiting for Cody to finish learning before sending the next batch…`);
          await new Promise((r) => setTimeout(r, POLL_MS));
        }
        setNotice(null);
      }
    } catch (e) {
      setNotice(`Queue stopped: ${(e as Error).message}`);
    } finally {
      setRunning(false);
    }
  }, [running, batches.length, patch]);

  // Keep polling batches that were left "learning" (e.g. after Skip wait) so statuses stay live.
  useEffect(() => {
    const open = batches.filter((b) => b.status === "learning" || b.status === "sending");
    if (running || open.length === 0) return;
    const t = setInterval(async () => {
      for (const run of open) {
        const { batch, logs } = await getBatch(run.id).catch(() => ({ batch: null, logs: [] }));
        for (const l of logs) {
          const it = itemsRef.current.find((i) => i.logId === l.id);
          if (it && it.status !== l.status) patch(it.id, { status: l.status as LogStatus });
        }
        if (batch) setBatches((b) => b.map((r) => (r.id === run.id ? { ...r, status: batch.status } : r)));
      }
    }, POLL_MS);
    return () => clearInterval(t);
  }, [batches, running, patch]);

  // Warn before closing the tab while work is in flight (files live only in memory).
  const busy = running || items.some((x) => x.status === "queued");
  useEffect(() => {
    if (!busy) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [busy]);

  return {
    items,
    batches,
    running,
    notice,
    waitForLearning,
    setWaitForLearning,
    enqueue,
    remove,
    clearFinished,
    start,
    pause: () => (pauseRef.current = true),
    skipWait: () => (skipWaitRef.current = true),
    fileFor: (fileId: string) => files.current.get(fileId),
  };
}
