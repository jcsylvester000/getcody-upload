import { NextResponse, type NextRequest } from "next/server";
import { getSignedUrl } from "@/lib/server/cody";
import { getLog, setLog } from "@/lib/server/logs";
import { bad, fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/** Step 1: get a one-time S3 URL. The browser PUTs the file straight to it (no size limit from our server). */
export async function POST(req: NextRequest) {
  const { log_id } = ((await req.json().catch(() => ({}))) ?? {}) as { log_id?: string };
  const log = log_id ? await getLog(log_id) : null;
  if (!log) return bad("Unknown upload.", 404);
  try {
    const { url, key } = await getSignedUrl(log.file_name, log.content_type ?? "application/octet-stream");
    await setLog(log.id, { status: "uploading", cody_key: key });
    return NextResponse.json({ url });
  } catch (e) {
    return fail(e);
  }
}
