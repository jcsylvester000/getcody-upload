import { NextResponse, type NextRequest } from "next/server";
import { CodyError, createDocumentFromFile } from "@/lib/server/cody";
import { getLog, setLog } from "@/lib/server/logs";
import { bad, fail } from "@/lib/server/http";
import { logActivity, ref } from "@/lib/server/activity";

export const dynamic = "force-dynamic";

/** Step 3: tell Cody to create the document in the folder. Cody then converts + learns it automatically. */
export async function POST(req: NextRequest) {
  const { log_id } = ((await req.json().catch(() => ({}))) ?? {}) as { log_id?: string };
  const log = log_id ? await getLog(log_id) : null;
  if (!log) return bad("Unknown upload.", 404);
  if (!log.cody_key) return bad("File was not uploaded yet.", 409);
  try {
    await createDocumentFromFile(log.folder_id, log.cody_key);
    await setLog(log.id, { status: "uploaded", sent: true });
    await logActivity({ action: "upload_sent", ...ref(log) });
    return NextResponse.json({ ok: true });
  } catch (e) {
    // 429 = too many files still processing at Cody; client waits and retries, row stays "uploading".
    if (e instanceof CodyError && e.status === 429) {
      await logActivity({ action: "cody_busy_retry", ...ref(log) });
    } else {
      await setLog(log.id, { status: "error", error: (e as Error).message }).catch(() => {});
      await logActivity({ action: "upload_failed", ...ref(log), detail: { error: (e as Error).message } });
    }
    return fail(e);
  }
}
