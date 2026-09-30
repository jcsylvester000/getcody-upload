import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { AUTH_COOKIE, sessionToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const pw = process.env.APP_PASSWORD ?? "";
  const { password } = ((await req.json().catch(() => ({}))) ?? {}) as { password?: string };
  const a = Buffer.from(String(password ?? ""));
  const b = Buffer.from(pw);
  const ok = pw.length > 0 && a.length === b.length && timingSafeEqual(a, b);
  if (!ok) {
    await new Promise((r) => setTimeout(r, 600)); // slow down guessing
    return NextResponse.json({ message: "Wrong password." }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, await sessionToken(pw), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(AUTH_COOKIE);
  return res;
}
