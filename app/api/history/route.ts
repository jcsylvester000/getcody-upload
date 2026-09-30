import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/** Upload history from Neon: /api/history?limit=200&folder_id=… */
export async function GET(req: NextRequest) {
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit")) || 200, 1000);
  const folder = req.nextUrl.searchParams.get("folder_id");
  try {
    const sql = await db();
    const rows = folder
      ? await sql`select l.*, b.status as batch_status from upload_logs l join upload_batches b on b.id = l.batch_id
          where l.folder_id = ${folder} order by l.created_at desc limit ${limit}`
      : await sql`select l.*, b.status as batch_status from upload_logs l join upload_batches b on b.id = l.batch_id
          order by l.created_at desc limit ${limit}`;
    return NextResponse.json({ data: rows });
  } catch (e) {
    return fail(e);
  }
}
