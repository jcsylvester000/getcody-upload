import "server-only";
import { db } from "./db";
import type { UploadLog } from "@/lib/types";

export async function getLog(id: string): Promise<UploadLog | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const sql = await db();
  const [row] = await sql`select * from upload_logs where id = ${id}`;
  return (row as UploadLog) ?? null;
}

export async function setLog(id: string, fields: { status: string; error?: string | null; cody_key?: string; sent?: boolean }) {
  const sql = await db();
  await sql`update upload_logs set
      status = ${fields.status},
      error = ${fields.error ?? null},
      cody_key = coalesce(${fields.cody_key ?? null}, cody_key),
      sent_at = case when ${fields.sent ?? false} then now() else sent_at end,
      updated_at = now()
    where id = ${id}`;
}
