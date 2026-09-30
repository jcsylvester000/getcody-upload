import { NextResponse, type NextRequest } from "next/server";
import { createFolder, listFolders } from "@/lib/server/cody";
import { bad, fail } from "@/lib/server/http";
import { logActivity } from "@/lib/server/activity";

export const dynamic = "force-dynamic";

/** All Cody folders the API key can see (follows every page). */
export async function GET() {
  try {
    const folders = await listFolders();
    folders.sort((a, b) => a.name.localeCompare(b.name));
    return NextResponse.json({ data: folders, total: folders.length });
  } catch (e) {
    return fail(e);
  }
}

/** Create a new Cody folder: { name } */
export async function POST(req: NextRequest) {
  const { name } = ((await req.json().catch(() => ({}))) ?? {}) as { name?: string };
  const clean = String(name ?? "").trim().replace(/\s+/g, " ");
  if (clean.length < 1 || clean.length > 100) return bad("Folder name must be 1–100 characters.");
  try {
    const existing = await listFolders();
    if (existing.some((f) => f.name.toLowerCase() === clean.toLowerCase())) {
      return bad(`A folder named “${clean}” already exists.`, 409);
    }
    const folder = await createFolder(clean);
    await logActivity({ action: "folder_created", folder_id: folder?.id, folder_name: clean });
    return NextResponse.json({ data: folder }, { status: 201 });
  } catch (e) {
    return fail(e);
  }
}
