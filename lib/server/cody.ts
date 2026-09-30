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

type Pagination = {
  count?: number;
  total?: number;
  per_page?: number;
  current_page?: number;
  total_pages?: number;
  next_page?: number | string | null;
  links?: { next?: string | null };
};
type Page<T> = {
  data: T[];
  meta?: { pagination?: Pagination; current_page?: number; last_page?: number; per_page?: number; total?: number };
  links?: { next?: string | null };
};

/** Turns a "next" value (number or full URL) into a page number. */
function toPage(v: unknown): number | null {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    if (/^\d+$/.test(v)) return Number(v);
    try {
      const p = new URL(v).searchParams.get("page");
      return p ? Number(p) : null;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Fetches every page. Cody pages at 15 by default, so we:
 *  - follow meta.pagination.next_page (number or URL), links.next, or current/total pages
 *  - if no hint is given but the page was full, still try the next page
 *  - stop when a page is empty or only repeats items already seen (page param ignored)
 */
async function all<T extends { id: string }>(path: string, params: Record<string, string> = {}, maxPages = 200): Promise<T[]> {
  const out: T[] = [];
  const seen = new Set<string>();
  let page: number | null = 1;
  for (let n = 0; page && n < maxPages; n++) {
    const qs = new URLSearchParams({ ...params, page: String(page), per_page: "100" });
    const r: Page<T> = await cody<Page<T>>(`${path}?${qs}`);
    const items = r.data ?? [];
    const fresh = items.filter((i) => !seen.has(i.id));
    if (fresh.length === 0) break;
    fresh.forEach((i) => seen.add(i.id));
    out.push(...fresh);

    const p = r.meta?.pagination ?? {};
    const current: number = p.current_page ?? r.meta?.current_page ?? page;
    const lastPage = p.total_pages ?? r.meta?.last_page;
    const perPage = p.per_page ?? r.meta?.per_page ?? 15;
    const total = p.total ?? r.meta?.total;

    let next = toPage(p.next_page) ?? toPage(p.links?.next) ?? toPage(r.links?.next);
    if (!next && lastPage && current < lastPage) next = current + 1;
    if (!next && !lastPage && items.length >= perPage) next = current + 1; // no hints: probe
    if (total && out.length >= total) next = null;
    page = next && next > current ? next : null;
  }
  return out;
}

/** Diagnostic: raw pagination metadata for the first two pages (no secrets). */
export async function debugPagination(path = "/folders") {
  const pages = [];
  for (const page of [1, 2]) {
    const r = await cody<Page<{ id: string; name?: string }>>(`${path}?page=${page}&per_page=100`);
    pages.push({ page, count: r.data?.length ?? 0, first: r.data?.[0]?.name, meta: r.meta, links: r.links });
  }
  return pages;
}

export const listFolders = () => all<CodyFolder>("/folders");

/** Cody POST /folders { name } → the new folder. */
export async function createFolder(name: string) {
  const r = await cody<{ data: CodyFolder }>("/folders", { method: "POST", body: JSON.stringify({ name }) });
  return r.data;
}

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
