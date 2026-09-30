import { NextResponse, type NextRequest } from "next/server";
import { deleteDocument, getDocument } from "@/lib/server/cody";
import { db } from "@/lib/server/db";
import { logActivity } from "@/lib/server/activity";
import { bad, fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/** DELETE /api/cody/documents/:id  body { folder_name? } — deletes from Cody and records it. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[\w-]{1,64}$/.test(id)) return bad("Invalid document id.");
  const { folder_name } = ((await req.json().catch(() => ({}))) ?? {}) as { folder_name?: string };
  try {
    const doc = await getDocument(id).catch(() => null); // for the audit trail
    await deleteDocument(id);
    // Deletion already happened at Cody — bookkeeping failures must not report it as failed.
    try {
      const sql = await db();
      await sql`update upload_logs set deleted_at = now(), updated_at = now() where cody_document_id = ${id}`;
    } catch (e) {
      console.error("[delete] history update failed", (e as Error).message);
    }
    await logActivity({
      action: "document_deleted",
      file_name: doc?.name ?? null,
      folder_id: doc?.folder_id ?? null,
      folder_name: folder_name ?? null,
      detail: { cody_document_id: id },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
