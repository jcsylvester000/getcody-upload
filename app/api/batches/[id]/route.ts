import { NextResponse } from "next/server";
import { refreshBatch } from "@/lib/server/sync";
import { fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/** Re-checks Cody for every in-flight document in the batch and returns fresh statuses. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    return NextResponse.json(await refreshBatch(id));
  } catch (e) {
    return fail(e);
  }
}
