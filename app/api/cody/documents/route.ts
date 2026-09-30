import { NextResponse, type NextRequest } from "next/server";
import { listDocuments } from "@/lib/server/cody";
import { bad, fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/** Documents for one or more folders: /api/cody/documents?folder_ids=a,b,c */
export async function GET(req: NextRequest) {
  const ids = (req.nextUrl.searchParams.get("folder_ids") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (ids.length === 0) return NextResponse.json({ data: [] });
  if (ids.length > 25) return bad("Select 25 folders or fewer.");
  try {
    const lists = await Promise.all(ids.map((id) => listDocuments(id)));
    const data = lists.flat().sort((a, b) => b.created_at - a.created_at);
    return NextResponse.json({ data });
  } catch (e) {
    return fail(e);
  }
}
