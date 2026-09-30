"use client";
// Browser-side calls to OUR API routes. The Cody key never reaches the browser.
import type { Batch, CodyBot, CodyDocument, CodyFolder, UploadLog } from "./types";

async function json<T>(r: Response): Promise<T> {
  const body = await r.json().catch(() => null);
  if (!r.ok) {
    const err = new Error(body?.message ?? `Request failed (${r.status})`) as Error & { status?: number; retryAfter?: number };
    err.status = r.status;
    err.retryAfter = Number(r.headers.get("retry-after")) || body?.retry_after;
    if (r.status === 401) window.dispatchEvent(new Event("grid:locked"));
    throw err;
  }
  return body as T;
}

const post = (url: string, data: unknown) =>
  fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const getFolders = () => fetch("/api/cody/folders").then((r) => json<{ data: CodyFolder[] }>(r)).then((d) => d.data);

export const getBots = () => fetch("/api/cody/bots").then((r) => json<{ data: CodyBot[] }>(r)).then((d) => d.data);

export const createFolder =(name: string) =>
  post("/api/cody/folders", { name }).then((r) => json<{ data: CodyFolder }>(r)).then((d) => d.data);

export const getDocuments =(folderIds: string[]) =>
  fetch(`/api/cody/documents?folder_ids=${encodeURIComponent(folderIds.join(","))}`)
    .then((r) => json<{ data: CodyDocument[] }>(r))
    .then((d) => d.data);

export const deleteDocument = (id: string, folderName?: string) =>
  fetch(`/api/cody/documents/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ folder_name: folderName }),
  }).then((r) => json(r));

export type Stats = {
  days: number;
  totals: {
    uploads: number;
    learned: number;
    failed: number;
    in_progress: number;
    deleted: number;
    bytes_learned: string | number;
    folders: number;
    batches: number;
    avg_learn_seconds: number | null;
    last_upload: string | null;
  };
  folders: {
    folder_id: string;
    folder_name: string | null;
    uploads: number;
    learned: number;
    failed: number;
    in_progress: number;
    deleted: number;
    bytes: string | number;
    last_upload: string;
  }[];
  daily: { day: string; uploads: number; learned: number; failed: number }[];
  types: { ext: string; uploads: number }[];
};

export const getStats = (days: number) => fetch(`/api/stats?days=${days}`).then((r) => json<Stats>(r));

export type Activity = {
  id: number;
  created_at: string;
  action: string;
  source: "server" | "client";
  file_name: string | null;
  folder_id: string | null;
  folder_name: string | null;
  batch_id: string | null;
  detail: Record<string, unknown> | null;
};

export const getActivity = (after = 0, limit = 100) =>
  fetch(`/api/activity?after=${after}&limit=${limit}`).then((r) => json<{ data: Activity[] }>(r)).then((d) => d.data);

/** Fire-and-forget audit event from the browser. */
export function logClient(action: string, fields: { file_name?: string; folder_id?: string; folder_name?: string; detail?: Record<string, unknown> } = {}) {
  void post("/api/activity", { action, ...fields }).catch(() => {});
}

export const getHistory =(limit = 300) =>
  fetch(`/api/history?limit=${limit}`).then((r) => json<{ data: (UploadLog & { batch_status: string })[] }>(r)).then((d) => d.data);

export const getBatch = (id: string) => fetch(`/api/batches/${id}`).then((r) => json<{ batch: Batch; logs: UploadLog[] }>(r));

export type NewBatchItem = {
  client_id: string;
  file_name: string;
  file_size: number;
  content_type: string;
  folder_id: string;
  folder_name: string;
};

export const createBatch = (items: NewBatchItem[]) =>
  post("/api/batches", { items }).then((r) => json<{ batch_id: string; logs: { client_id: string; log_id: string }[] }>(r));

const PROXY_LIMIT = 5.5 * 1024 * 1024;

function putWithProgress(url: string, file: File, type: string, onProgress: (p: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", type);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(`Storage upload failed (${xhr.status})`)));
    xhr.onerror = () => reject(Object.assign(new Error("Direct upload blocked"), { network: true }));
    xhr.send(file);
  });
}

/**
 * Full Cody flow for one file→folder:
 *  1. /api/uploads/sign      (server asks Cody for an S3 URL)
 *  2. PUT file to S3          (direct from browser; falls back to server relay if blocked)
 *  3. /api/uploads/register   (server calls Cody POST /documents/file — Cody starts learning)
 */
export async function uploadOne(
  file: File,
  logId: string,
  contentType: string,
  onProgress: (p: number) => void,
  onWait: (msg: string | null) => void,
) {
  try {
    const { url } = await post("/api/uploads/sign", { log_id: logId }).then((r) => json<{ url: string }>(r));
    try {
      await putWithProgress(url, file, contentType, onProgress);
    } catch (e) {
      if (!(e as { network?: boolean }).network) throw e;
      if (file.size > PROXY_LIMIT) {
        throw new Error("Browser upload was blocked (storage CORS) and file is over 5.5 MB for the server relay.");
      }
      const fd = new FormData();
      fd.append("file", file);
      fd.append("log_id", logId);
      await fetch("/api/uploads/proxy", { method: "POST", body: fd }).then((r) => json(r));
      onProgress(100);
    }

    // Register; Cody answers 429 while too many files are still converting — wait and retry.
    for (let attempt = 0; ; attempt++) {
      try {
        await post("/api/uploads/register", { log_id: logId }).then((r) => json(r));
        onWait(null);
        return;
      } catch (e) {
        const err = e as Error & { status?: number; retryAfter?: number };
        if (err.status !== 429 || attempt >= 40) throw err;
        const wait = Math.min(Math.max(err.retryAfter ?? 30, 10), 120);
        onWait(`Cody is busy processing earlier files — retrying in ${wait}s`);
        await sleep(wait * 1000);
      }
    }
  } catch (e) {
    await post("/api/uploads/fail", { log_id: logId, error: (e as Error).message }).catch(() => {});
    throw e;
  }
}
