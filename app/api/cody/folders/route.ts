import { NextResponse } from "next/server";
import { listFolders } from "@/lib/server/cody";
import { fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/** All Cody folders the API key can see (follows pagination). */
export async function GET() {
  try {
    const folders = await listFolders();
    folders.sort((a, b) => a.name.localeCompare(b.name));
    return NextResponse.json({ data: folders });
  } catch (e) {
    return fail(e);
  }
}
