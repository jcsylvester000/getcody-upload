import "server-only";
import { db } from "./db";
import { listDocuments } from "./cody";
import type { Batch, BatchStatus, CodyDocument, UploadLog } from "@/lib/types";

const TIMEOUT_MIN = 65; // Cody times out failed conversions after ~1 h
const norm = (s: string) =>
  s.toLowerCase().replace(/\.[a-z0-9]{2,5}$/, "").replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Cody's POST /documents/file returns no document id, so we find the new
 * document by folder + name + creation time, then track its learning status.
 */
export async function refreshBatch(batchId: string): Promise<{ batch: Batch; logs: UploadLog[] }> {
  const sql = await db();
  const logs = (await sql`select * from upload_logs where batch_id = ${batchId} order by created_at`) as UploadLog[];
  const pending = logs.filter((l) => l.status === "uploaded" || l.status === "syncing");

  if (pending.length) {
    const claimedRows = await sql`select cody_document_id from upload_logs where cody_document_id is not null`;
    const claimed = new Set(claimedRows.map((r) => r.cody_document_id as string));
    const cache = new Map<string, CodyDocument[]>();
    const docsFor = async (folderId: string, keyword?: string) => {
      const k = `${folderId}|${keyword ?? ""}`;
      if (!cache.has(k)) cache.set(k, await listDocuments(folderId, keyword));
      return cache.get(k)!;
    };

    for (const log of pending) {
      try {
        let doc: CodyDocument | undefined;
        if (log.cody_document_id) {
          doc = (await docsFor(log.folder_id, norm(log.file_name))).find((d) => d.id === log.cody_document_id)
            ?? (await docsFor(log.folder_id)).find((d) => d.id === log.cody_document_id);
        } else {
          const sentAt = log.sent_at ? Math.floor(new Date(log.sent_at).getTime() / 1000) : 0;
          const base = norm(log.file_name);
          const pick = (list: CodyDocument[]) =>
            list
              .filter((d) => !claimed.has(d.id) && d.created_at >= sentAt - 120)
              .filter((d) => {
                const n = norm(d.name);
                return n === base || n.includes(base) || base.includes(n);
              })
              .sort((a, b) => a.created_at - b.created_at)[0];
          doc = pick(await docsFor(log.folder_id, base)) ?? pick(await docsFor(log.folder_id));
          if (doc) claimed.add(doc.id);
        }

        if (doc) {
          await sql`update upload_logs set
              cody_document_id = ${doc.id},
              status = ${doc.status},
              learned_at = ${doc.status === "synced" ? new Date().toISOString() : null},
              updated_at = now()
            where id = ${log.id}`;
        } else if (log.sent_at && Date.now() - new Date(log.sent_at).getTime() > TIMEOUT_MIN * 60_000) {
          await sql`update upload_logs set status = 'timeout', error = 'Cody did not create the document within 65 min', updated_at = now() where id = ${log.id}`;
        }
      } catch (e) {
        console.error("[sync]", log.id, (e as Error).message); // keep polling next time
      }
    }
  }

  const fresh = (await sql`select * from upload_logs where batch_id = ${batchId} order by created_at`) as UploadLog[];
  const status = batchStatus(fresh);
  const done = ["complete", "partial", "failed"].includes(status);
  const [batch] = (await sql`update upload_batches set status = ${status},
      completed_at = case when ${done} then coalesce(completed_at, now()) else null end
    where id = ${batchId} returning *`) as Batch[];
  return { batch, logs: fresh };
}

function batchStatus(logs: UploadLog[]): BatchStatus {
  const s = logs.map((l) => l.status);
  if (s.some((x) => x === "queued" || x === "uploading")) return "sending";
  if (s.some((x) => x === "uploaded" || x === "syncing")) return "learning";
  const ok = s.filter((x) => x === "synced").length;
  if (ok === s.length) return "complete";
  return ok === 0 ? "failed" : "partial";
}
