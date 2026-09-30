import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, accessCode, sessionToken } from "@/lib/auth";

/**
 * Server-side guard for every API route. The page itself shows a password modal on
 * every load (components/PasswordGate.tsx); unlocking it sets this cookie, so the
 * Cody key and database can't be used by anyone who hasn't entered the code.
 */
export async function proxy(req: NextRequest) {
  const cookie = req.cookies.get(AUTH_COOKIE)?.value;
  if (cookie && cookie === (await sessionToken(accessCode()))) return NextResponse.next();
  return NextResponse.json({ message: "Locked. Enter the access code." }, { status: 401 });
}

export const config = {
  matcher: ["/api/((?!login).*)"],
};
