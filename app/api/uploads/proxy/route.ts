import { NextResponse, type NextRequest } from "next/server";
import { getSignedUrl, putToS3 } from "@/lib/server/cody";
import { getLog, setLog } from "@/lib/server/logs";
import { bad, fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";

// Netlify functions accept ~6 MB request bodies; keep a margin.
const PROXY_LIMIT = 5.5 * 1024 * 1024;

/** Fallback when the browser can't PUT to S3 directly (CORS): server signs + uploads. */
export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const logId = form?.get("log_id");
  if (!(file instanceof File) || typeof logId !== "string") return bad("file and log_id are required.");
  if (file.size > PROXY_LIMIT) return bad("File too large for server relay (max 5.5 MB).", 413);
  const log = await getLog(logId);
  if (!log) return bad("Unknown upload.", 404);
  try {
    const type = log.content_type ?? "application/octet-stream";
    const { url, key } = await getSignedUrl(log.file_name, type);
    await putToS3(url, await file.arrayBuffer(), type);
    await setLog(log.id, { status: "uploading", cody_key: key });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
