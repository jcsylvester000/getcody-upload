import "server-only";
import { db } from "./db";

export type ActivityInput = {
  action: string;
  source?: "server" | "client";
  file_name?: string | null;
  folder_id?: string | null;
  folder_name?: string | null;
  upload_log_id?: string | null;
  batch_id?: string | null;
  detail?: Record<string, unknown> | null;
};

/** Common fields from an upload_logs row. */
export const ref = (l: { id: string; batch_id: string; file_name: string; folder_id: string; folder_name: string | null }) => ({
  upload_log_id: l.id,
  batch_id: l.batch_id,
  file_name: l.file_name,
  folder_id: l.folder_id,
  folder_name: l.folder_name,
});

/** Append one audit row. Never throws — logging must not break uploads. Never pass secrets. */
export async function logActivity(a: ActivityInput) {
  try {
    const sql = await db();
    await sql`insert into activity_log (action, source, file_name, folder_id, folder_name, upload_log_id, batch_id, detail)
      values (${a.action}, ${a.source ?? "server"}, ${a.file_name ?? null}, ${a.folder_id ?? null}, ${a.folder_name ?? null},
              ${a.upload_log_id ?? null}, ${a.batch_id ?? null}, ${a.detail ? JSON.stringify(a.detail) : null})`;
  } catch (e) {
    console.error("[activity]", (e as Error).message);
  }
}
