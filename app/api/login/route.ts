import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { AUTH_COOKIE, accessCode, sessionToken } from "@/lib/auth";
import { logActivity } from "@/lib/server/activity";

export const dynamic = "force-dynamic";

/** Unlock: checks the access code and sets a browser-session cookie for the API. */
export async function POST(req: NextRequest) {
  const code = accessCode();
  const { password } = ((await req.json().catch(() => ({}))) ?? {}) as { password?: string };
  const a = Buffer.from(String(password ?? ""));
  const b = Buffer.from(code);
  const ok = a.length === b.length && timingSafeEqual(a, b);
  if (!ok) {
    await logActivity({ action: "unlock_failed" });
    await new Promise((r) => setTimeout(r, 700)); // slow down guessing
    return NextResponse.json({ message: "Incorrect access code." }, { status: 401 });
  }
  await logActivity({ action: "unlocked" });
  const res = NextResponse.json({ ok: true });
  // No maxAge → session cookie (cleared when the browser closes).
  res.cookies.set(AUTH_COOKIE, await sessionToken(code), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(AUTH_COOKIE);
  return res;
}
