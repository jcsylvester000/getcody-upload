// Usage: npm run db:migrate   (reads DATABASE_URL from .env.local)
// Optional — the app also creates tables automatically on first API call.
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL missing in .env.local");
  process.exit(1);
}
const sql = neon(url);
const ddl = readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8")
  .replace(/--.*$/gm, "")
  .split(";")
  .map((s) => s.trim())
  .filter(Boolean);

for (const stmt of ddl) await sql.query(stmt);
console.log(`Applied ${ddl.length} statements. Tables: upload_batches, upload_logs.`);
