import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { bad, fail } from "@/lib/server/http";
import { ALLOWED_EXTENSIONS, MAX_FILE_BYTES, extOf } from "@/lib/file-rules";

export const dynamic = "force-dynamic";
export const BATCH_LIMIT = 10; // Cody: max 10 documents per batch

type Item = { client_id: string; file_name: string; file_size: number; content_type: string; folder_id: string; folder_name: string };

/** Opens a batch (≤10 items) and writes one history row per file→folder. */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { items?: Item[] } | null;
  const items = body?.items ?? [];
  if (items.length < 1 || items.length > BATCH_LIMIT) return bad(`A batch must have 1–${BATCH_LIMIT} items.`);
  for (const it of items) {
    if (!it.file_name || !it.folder_id) return bad("Each item needs file_name and folder_id.");
    if (!ALLOWED_EXTENSIONS.includes(extOf(it.file_name) as (typeof ALLOWED_EXTENSIONS)[number])) return bad(`${it.file_name}: file type not allowed.`);
    if (!(it.file_size > 0 && it.file_size <= MAX_FILE_BYTES)) return bad(`${it.file_name}: size must be 1 byte–100 MB.`);
  }
  try {
    const sql = await db();
    const [batch] = await sql`insert into upload_batches (item_count) values (${items.length}) returning id`;
    const logs: { client_id: string; log_id: string }[] = [];
    for (const it of items) {
      const [row] = await sql`insert into upload_logs
          (batch_id, file_name, file_size, content_type, folder_id, folder_name, status)
        values (${batch.id}, ${it.file_name}, ${it.file_size}, ${it.content_type}, ${it.folder_id}, ${it.folder_name}, 'queued')
        returning id`;
      logs.push({ client_id: it.client_id, log_id: row.id });
    }
    return NextResponse.json({ batch_id: batch.id, logs });
  } catch (e) {
    return fail(e);
  }
}
