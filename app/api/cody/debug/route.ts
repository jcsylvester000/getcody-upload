import { NextResponse } from "next/server";
import { debugPagination, listFolders } from "@/lib/server/cody";
import { fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/** /api/cody/debug — shows how Cody paginates folders + how many the app retrieved. Behind the login gate. */
export async function GET() {
  try {
    const [raw, all] = await Promise.all([debugPagination("/folders"), listFolders()]);
    return NextResponse.json({ folders_retrieved: all.length, raw_pages: raw });
  } catch (e) {
    return fail(e);
  }
}
