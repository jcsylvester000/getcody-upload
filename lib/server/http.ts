import "server-only";
import { NextResponse } from "next/server";
import { CodyError } from "./cody";

export function fail(e: unknown) {
  if (e instanceof CodyError) {
    return NextResponse.json(
      { message: e.message, retry_after: e.retryAfter },
      { status: e.status, headers: e.retryAfter ? { "retry-after": String(e.retryAfter) } : {} },
    );
  }
  const message = e instanceof Error ? e.message : "Unexpected error";
  console.error("[api]", message);
  return NextResponse.json({ message }, { status: 500 });
}

export const bad = (message: string, status = 400) => NextResponse.json({ message }, { status });
