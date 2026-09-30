import { NextResponse } from "next/server";
import { listFolders } from "@/lib/server/cody";
import { db } from "@/lib/server/db";

export const dynamic = "force-dynamic";

/** Connection check for Cody + Neon. Never returns secrets. */
export async function GET() {
  const out = { cody: { ok: false, detail: "" }, database: { ok: false, detail: "" } };
  await Promise.all([
    listFolders()
      .then((f) => (out.cody = { ok: true, detail: `${f.length} folders visible` }))
      .catch((e) => (out.cody = { ok: false, detail: (e as Error).message })),
    db()
      .then((sql) => sql`select count(*)::int as n from upload_logs`)
      .then((r) => (out.database = { ok: true, detail: `${r[0].n} history rows` }))
      .catch((e) => (out.database = { ok: false, detail: (e as Error).message })),
  ]);
  return NextResponse.json(out, { status: out.cody.ok && out.database.ok ? 200 : 503 });
}
