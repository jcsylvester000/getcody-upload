import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { fail } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/** Dashboard numbers from Neon upload history: /api/stats?days=30 (0 = all time). */
export async function GET(req: NextRequest) {
  const days = Math.max(0, Math.min(Number(req.nextUrl.searchParams.get("days") ?? 30) || 0, 3650));
  const since = days ? new Date(Date.now() - days * 86_400_000).toISOString() : "1970-01-01T00:00:00Z";
  try {
    const sql = await db();
    const [totals, folders, daily, types] = await Promise.all([
      sql`select
            count(*)::int                                                                   as uploads,
            count(*) filter (where status = 'synced')::int                                  as learned,
            count(*) filter (where status in ('error','sync_failed','timeout'))::int        as failed,
            count(*) filter (where status in ('queued','uploading','uploaded','syncing'))::int as in_progress,
            count(*) filter (where deleted_at is not null)::int                             as deleted,
            coalesce(sum(file_size) filter (where status = 'synced'), 0)::bigint            as bytes_learned,
            count(distinct folder_id)::int                                                  as folders,
            count(distinct batch_id)::int                                                   as batches,
            round(avg(extract(epoch from (learned_at - sent_at)))
                  filter (where learned_at is not null and sent_at is not null))::int       as avg_learn_seconds,
            max(created_at)                                                                 as last_upload
          from upload_logs where created_at >= ${since}`,
      sql`select folder_id,
            max(folder_name)                                                         as folder_name,
            count(*)::int                                                            as uploads,
            count(*) filter (where status = 'synced')::int                           as learned,
            count(*) filter (where status in ('error','sync_failed','timeout'))::int as failed,
            count(*) filter (where status in ('queued','uploading','uploaded','syncing'))::int as in_progress,
            count(*) filter (where deleted_at is not null)::int                      as deleted,
            coalesce(sum(file_size), 0)::bigint                                      as bytes,
            max(created_at)                                                          as last_upload
          from upload_logs where created_at >= ${since}
          group by folder_id order by uploads desc`,
      sql`select to_char(date_trunc('day', created_at at time zone 'Asia/Manila'), 'YYYY-MM-DD') as day,
            count(*)::int as uploads,
            count(*) filter (where status = 'synced')::int as learned,
            count(*) filter (where status in ('error','sync_failed','timeout'))::int as failed
          from upload_logs where created_at >= ${since}
          group by 1 order by 1`,
      sql`select coalesce(lower(substring(file_name from '\\.([A-Za-z0-9]+)$')), 'other') as ext, count(*)::int as uploads
          from upload_logs where created_at >= ${since}
          group by 1 order by 2 desc`,
    ]);
    return NextResponse.json({ days, totals: totals[0], folders, daily, types });
  } catch (e) {
    return fail(e);
  }
}
