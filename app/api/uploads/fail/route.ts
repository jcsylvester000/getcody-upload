import { NextResponse, type NextRequest } from "next/server";
import { getLog, setLog } from "@/lib/server/logs";
import { bad, fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/** Records a client-side failure (e.g. storage upload) in history. */
export async function POST(req: NextRequest) {
  const { log_id, error } = ((await req.json().catch(() => ({}))) ?? {}) as { log_id?: string; error?: string };
  const log = log_id ? await getLog(log_id) : null;
  if (!log) return bad("Unknown upload.", 404);
  try {
    await setLog(log.id, { status: "error", error: (error ?? "Upload failed").slice(0, 500) });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
