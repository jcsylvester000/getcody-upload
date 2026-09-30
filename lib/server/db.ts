import "server-only";
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { SCHEMA_STATEMENTS } from "@/db/schema";

let _sql: NeonQueryFunction<false, false> | null = null;
let _ready: Promise<void> | null = null;

export function sql() {
  if (!_sql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set (.env.local locally, Netlify env vars in production)");
    _sql = neon(url);
  }
  return _sql;
}

/** Creates tables on first use (idempotent). Embedded in code so it works inside Netlify functions. */
function ensureSchema() {
  if (!_ready) {
    _ready = (async () => {
      for (const stmt of SCHEMA_STATEMENTS) await sql().query(stmt);
    })().catch((e) => {
      _ready = null;
      throw e;
    });
  }
  return _ready;
}

export async function db() {
  await ensureSchema();
  return sql();
}
