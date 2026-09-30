import "server-only";
import type { CodyDocument, CodyFolder } from "@/lib/types";

const BASE = process.env.CODY_API_BASE ?? "https://getcody.ai/api/v1";

export class CodyError extends Error {
  constructor(message: string, public status: number, public retryAfter?: number) {
    super(message);
  }
}

function key() {
  const k = process.env.CODY_API_KEY;
  if (!k) throw new CodyError("CODY_API_KEY is not set in .env.local", 500);
  return k;
}

async function cody<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key()}`,
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
    cache: "no-store",
  });
  const text = await res.text();
  const json = text ? safeJson(text) : null;
  if (!res.ok) {
    const retry = Number(res.headers.get("retry-after")) || undefined;
    const msg =
      (json as { message?: string } | null)?.message ??
      (res.status === 401 ? "Cody rejected the API key (401)." : `Cody API error ${res.status}`);
    throw new CodyError(msg, res.status, retry);
  }
  return json as T;
}

function safeJson(t: string) {
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

type Page<T> = { data: T[]; meta?: { pagination?: { next_page: number | null; total_pages?: number } } };

/** Follows Cody's pagination (meta.pagination.next_page) until exhausted. */
async function all<T>(path: string, params: Record<string, string> = {}, maxPages = 50): Promise<T[]> {
  const out: T[] = [];
  let page: number | null = 1;
  let n = 0;
  while (page && n < maxPages) {
    const qs = new URLSearchParams({ ...params, page: String(page) });
    const r: Page<T> = await cody<Page<T>>(`${path}?${qs}`);
    out.push(...(r.data ?? []));
    page = r.meta?.pagination?.next_page ?? null;
    n++;
  }
  return out;
}

export const listFolders = () => all<CodyFolder>("/folders");

export const listDocuments = (folderId: string, keyword?: string) =>
  all<CodyDocument>("/documents", { folder_id: folderId, ...(keyword ? { keyword } : {}) });

export async function getSignedUrl(fileName: string, contentType: string) {
  // Cody docs show the payload under `data`; tolerate both shapes.
  const r = await cody<{ data?: { url: string; key: string }; url?: string; key?: string }>("/uploads/signed-url", {
    method: "POST",
    body: JSON.stringify({ file_name: fileName, content_type: contentType }),
  });
  const url = r.data?.url ?? r.url;
  const k = r.data?.key ?? r.key;
  if (!url || !k) throw new CodyError("Cody did not return an upload URL.", 502);
  return { url, key: k };
}

export async function putToS3(url: string, body: ArrayBuffer, contentType: string) {
  const res = await fetch(url, { method: "PUT", headers: { "Content-Type": contentType }, body });
  if (!res.ok) throw new CodyError(`Storage upload failed (${res.status}).`, 502);
}

/** Creates the document in the folder. Cody converts + learns it automatically. */
export async function createDocumentFromFile(folderId: string, key: string) {
  await cody("/documents/file", { method: "POST", body: JSON.stringify({ folder_id: folderId, key }) });
}
