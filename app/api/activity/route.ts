import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { logActivity } from "@/lib/server/activity";
import { bad, fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";

// Actions the browser may record (server-side events are written directly by the API routes).
const CLIENT_ACTIONS = new Set([
  "files_added",
  "item_assigned",
  "item_unassigned",
  "item_removed",
  "item_retried",
  "queue_started",
  "queue_paused",
  "wait_skipped",
]);

/** GET /api/activity?after=<id>&limit=100 — newest first (or only rows after an id, for live feeds). */
export async function GET(req: NextRequest) {
  const after = Number(req.nextUrl.searchParams.get("after")) || 0;
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit")) || 100, 500);
  try {
    const sql = await db();
    const rows = after
      ? await sql`select * from activity_log where id > ${after} order by id desc limit ${limit}`
      : await sql`select * from activity_log order by id desc limit ${limit}`;
    return NextResponse.json({ data: rows });
  } catch (e) {
    return fail(e);
  }
}

/** POST /api/activity { action, file_name?, folder_id?, folder_name?, detail? } */
export async function POST(req: NextRequest) {
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const action = String(b?.action ?? "");
  if (!CLIENT_ACTIONS.has(action)) return bad("Unknown action.");
  const str = (v: unknown) => (typeof v === "string" ? v.slice(0, 300) : null);
  const detail = b?.detail && typeof b.detail === "object" ? (b.detail as Record<string, unknown>) : null;
  if (detail && JSON.stringify(detail).length > 4000) return bad("Detail too large.");
  await logActivity({
    action,
    source: "client",
    file_name: str(b?.file_name),
    folder_id: str(b?.folder_id),
    folder_name: str(b?.folder_name),
    detail,
  });
  return NextResponse.json({ ok: true });
}
