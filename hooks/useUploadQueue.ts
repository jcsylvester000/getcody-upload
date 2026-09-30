"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FINAL_STATUSES, type BatchStatus, type CodyFolder, type LogStatus, type QueueItem } from "@/lib/types";
import { contentTypeFor } from "@/lib/file-rules";
import { createBatch, getBatch, logClient, uploadOne } from "@/lib/api";
import { idb } from "@/lib/idb";

export const BATCH_SIZE = 10; // Cody limit: 10 documents per batch
const POLL_MS = 5_000;
const STATE_KEY = "queue-state-v2";

export type BatchRun = { no: number; id: string; status: BatchStatus; itemIds: string[]; startedAt: number };
type Saved = { items: QueueItem[]; batches: BatchRun[]; waitForLearning: boolean; wasRunning: boolean };

const uid = () => Math.random().toString(36).slice(2, 10);
const isFinal = (s: QueueItem["status"]) => (FINAL_STATUSES as string[]).includes(s);
const SETTLED: BatchStatus[] = ["complete", "partial", "failed"];

/**
 * Upload queue shared by the Uploader and the Board.
 * - Each card = one file → one folder. Cards without a folder are "unassigned".
 * - Runner takes ≤10 queued cards → opens a batch (Neon) → uploads one by one →
 *   polls Cody every 5 s until the batch is learned (or failed) → next batch.
 * - Cards + files persist in IndexedDB, so a page refresh loses nothing.
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
  const batchesRef = useRef<BatchRun[]>([]);
  batchesRef.current = batches;
  const [running, setRunning] = useState(false);
  const runningRef = useRef(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [waitForLearning, setWaitForLearning] = useState(true);
  const [restored, setRestored] = useState(false);
  const [resumeNeeded, setResumeNeeded] = useState(false);
  const pauseRef = useRef(false);
  const skipWaitRef = useRef(false);
  const waitRef = useRef(true);
  waitRef.current = waitForLearning;

  // ---------- restore after refresh ----------
  useEffect(() => {
    (async () => {
      const saved = await idb.get<Saved>(STATE_KEY);
      if (saved?.items?.length) {
        for (const it of saved.items) {
          if (!files.current.has(it.fileId)) {
            const f = await idb.getFile(it.fileId);
            if (f) files.current.set(it.fileId, f);
          }
        }
        // Anything mid-upload when the page closed can't be trusted: mark it and let the user retry.
        const fixed = saved.items.map((it) => {
          const interrupted = it.status === "uploading" || (it.status === "queued" && it.logId);
          if (!interrupted) return it;
          if (it.logId) {
            void fetch("/api/uploads/fail", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ log_id: it.logId, error: "Interrupted by page refresh" }),
            }).catch(() => {});
          }
          return { ...it, status: "error" as const, error: "Interrupted by page refresh — press Retry" };
        });
        setItems(() => fixed);
        setBatches(saved.batches ?? []);
        setWaitForLearning(saved.waitForLearning ?? true);
        setResumeNeeded(Boolean(saved.wasRunning) && fixed.some((x) => x.status === "queued" && !x.logId));
      }
      setRestored(true);
    })();
  }, [setItems]);

  // ---------- persist ----------
  useEffect(() => {
    if (!restored) return;
    const t = setTimeout(() => {
      void idb.set(STATE_KEY, { items, batches, waitForLearning, wasRunning: running } satisfies Saved);
    }, 250);
    return () => clearTimeout(t);
  }, [items, batches, waitForLearning, running, restored]);

  const cleanupFiles = useCallback(() => {
    const used = new Set(itemsRef.current.map((x) => x.fileId));
    for (const id of [...files.current.keys()]) {
      if (!used.has(id)) {
        files.current.delete(id);
        void idb.delFile(id);
      }
    }
  }, []);

  // ---------- card actions ----------
  /** Add files. With folders → one queued card per folder; without → unassigned cards. */
  const addFiles = useCallback(
    (list: File[], folders: CodyFolder[] = []) => {
      const add: QueueItem[] = [];
      for (const file of list) {
        const fileId = uid();
        files.current.set(fileId, file);
        void idb.putFile(fileId, file);
        const base = {
          fileId,
          fileName: file.name,
          size: file.size,
          contentType: contentTypeFor(file),
          addedAt: Date.now(),
          progress: 0,
        };
        if (folders.length === 0) add.push({ ...base, id: uid(), folderId: "", folderName: "", status: "unassigned" });
        for (const f of folders) add.push({ ...base, id: uid(), folderId: f.id, folderName: f.name, status: "queued" });
      }
      setItems((all) => [...all, ...add]);
      logClient("files_added", {
        detail: { files: list.map((f) => f.name), folders: folders.map((f) => f.name), cards: add.length },
      });
      return add.length;
    },
    [setItems],
  );

  /** Uploader tab: staged files × ticked folders. */
  const enqueue = useCallback(
    (staged: { id: string; file: File }[], folders: CodyFolder[]) => addFiles(staged.map((s) => s.file), folders),
    [addFiles],
  );

  const assign = useCallback(
    (id: string, folder: CodyFolder) => {
      const it = itemsRef.current.find((x) => x.id === id);
      if (!it || it.logId) return;
      patch(id, { folderId: folder.id, folderName: folder.name, status: "queued", error: undefined });
      logClient("item_assigned", { file_name: it.fileName, folder_id: folder.id, folder_name: folder.name });
    },
    [patch],
  );

  const unassign = useCallback(
    (id: string) => {
      const it = itemsRef.current.find((x) => x.id === id);
      if (!it || it.logId) return;
      patch(id, { folderId: "", folderName: "", status: "unassigned" });
      logClient("item_unassigned", { file_name: it.fileName, folder_name: it.folderName });
    },
    [patch],
  );

  /** Send the same file to another folder too. */
  const duplicateTo = useCallback(
    (id: string, folder: CodyFolder) => {
      const it = itemsRef.current.find((x) => x.id === id);
      if (!it) return;
      const copy: QueueItem = {
        ...it,
        id: uid(),
        folderId: folder.id,
        folderName: folder.name,
        status: "queued",
        progress: 0,
        logId: undefined,
        batchNo: undefined,
        error: undefined,
        addedAt: Date.now(),
      };
      setItems((all) => [...all, copy]);
      logClient("item_assigned", { file_name: it.fileName, folder_id: folder.id, folder_name: folder.name, detail: { copy: true } });
    },
    [setItems],
  );

  const remove = useCallback(
    (id: string) => {
      const it = itemsRef.current.find((x) => x.id === id);
      if (!it || (it.logId && !isFinal(it.status))) return;
      setItems((all) => all.filter((x) => x.id !== id));
      cleanupFiles();
      logClient("item_removed", { file_name: it.fileName, folder_name: it.folderName });
    },
    [setItems, cleanupFiles],
  );

  const retry = useCallback(
    (id: string) => {
      const it = itemsRef.current.find((x) => x.id === id);
      if (!it || !files.current.has(it.fileId)) return;
      patch(id, { status: it.folderId ? "queued" : "unassigned", logId: undefined, batchNo: undefined, error: undefined, progress: 0 });
      logClient("item_retried", { file_name: it.fileName, folder_name: it.folderName });
    },
    [patch],
  );

  const clearFinished = useCallback(() => {
    setItems((all) => all.filter((x) => !isFinal(x.status)));
    cleanupFiles();
  }, [setItems, cleanupFiles]);

  // ---------- runner ----------
  const syncBatch = useCallback(
    async (run: BatchRun) => {
      const res = await getBatch(run.id).catch(() => null);
      if (!res) return null;
      for (const l of res.logs) {
        const it = itemsRef.current.find((i) => i.logId === l.id);
        if (it && it.status !== l.status && it.status !== "uploading") {
          patch(it.id, { status: l.status as LogStatus, error: l.error ?? undefined });
        }
      }
      setBatches((b) => b.map((r) => (r.id === run.id ? { ...r, status: res.batch.status } : r)));
      return res.batch.status;
    },
    [patch],
  );

  const start = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    setRunning(true);
    setResumeNeeded(false);
    pauseRef.current = false;
    logClient("queue_started", { detail: { waiting: itemsRef.current.filter((x) => x.status === "queued" && !x.logId).length } });
    let batchNo = Math.max(0, ...batchesRef.current.map((b) => b.no));
    try {
      while (!pauseRef.current) {
        const next = itemsRef.current.filter((x) => x.status === "queued" && !x.logId && x.folderId).slice(0, BATCH_SIZE);
        if (next.length === 0) break;
        batchNo += 1;

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

        for (const x of next) {
          const file = files.current.get(x.fileId);
          const logId = logByClient.get(x.id)!;
          if (!file) {
            patch(x.id, { status: "error", error: "File is no longer available in this browser." });
            await fetch("/api/uploads/fail", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ log_id: logId, error: "File missing in browser" }),
            }).catch(() => {});
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

        setBatches((b) => b.map((r) => (r.id === run.id ? { ...r, status: "learning" } : r)));
        skipWaitRef.current = false;
        for (;;) {
          const status = await syncBatch(run);
          if ((status && SETTLED.includes(status)) || !waitRef.current || skipWaitRef.current || pauseRef.current) break;
          setNotice(`Batch ${batchNo}: waiting for Cody to finish learning before the next batch…`);
          await new Promise((r) => setTimeout(r, POLL_MS));
        }
        setNotice(null);
      }
    } catch (e) {
      setNotice(`Queue stopped: ${(e as Error).message}`);
    } finally {
      runningRef.current = false;
      setRunning(false);
    }
  }, [patch, syncBatch]);

  // Keep batches that are still learning live, even when the runner is idle (after Skip wait or a refresh).
  useEffect(() => {
    if (running) return;
    const open = batches.filter((b) => !SETTLED.includes(b.status));
    if (open.length === 0) return;
    const t = setInterval(() => open.forEach((run) => void syncBatch(run)), POLL_MS);
    return () => clearInterval(t);
  }, [batches, running, syncBatch]);

  // Warn before closing only while a file is actively uploading.
  const uploading = items.some((x) => x.status === "uploading");
  useEffect(() => {
    if (!uploading) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [uploading]);

  return {
    items,
    batches,
    running,
    notice,
    restored,
    resumeNeeded,
    waitForLearning,
    setWaitForLearning,
    addFiles,
    enqueue,
    assign,
    unassign,
    duplicateTo,
    remove,
    retry,
    clearFinished,
    start,
    pause: () => {
      pauseRef.current = true;
      logClient("queue_paused");
    },
    skipWait: () => {
      skipWaitRef.current = true;
      logClient("wait_skipped");
    },
    fileFor: (fileId: string) => files.current.get(fileId),
  };
}

export type UploadQueue = ReturnType<typeof useUploadQueue>;
