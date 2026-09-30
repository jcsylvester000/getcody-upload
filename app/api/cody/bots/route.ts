import { NextResponse } from "next/server";
import { listBots } from "@/lib/server/cody";
import { fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/** All bots in the Cody account (id, name, model, created_at). Read-only — Cody API v1 has no bot create/edit. */
export async function GET() {
  try {
    const bots = await listBots();
    bots.sort((a, b) => a.name.localeCompare(b.name));
    return NextResponse.json({ data: bots });
  } catch (e) {
    return fail(e);
  }
}
