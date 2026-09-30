import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, sessionToken } from "@/lib/auth";

/**
 * Password gate. The deployed site can upload to Cody with your API key,
 * so it must not be open to the public.
 * - APP_PASSWORD set   -> login required.
 * - APP_PASSWORD unset -> open in local dev only; blocked in production.
 */
export async function proxy(req: NextRequest) {
  const pw = process.env.APP_PASSWORD;
  if (!pw) {
    if (process.env.NODE_ENV !== "production") return NextResponse.next();
    return new NextResponse("APP_PASSWORD is not configured on the server.", { status: 503 });
  }
  const cookie = req.cookies.get(AUTH_COOKIE)?.value;
  if (cookie && cookie === (await sessionToken(pw))) return NextResponse.next();

  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ message: "Not signed in." }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!login|api/login|_next/|brand/|icon.png|favicon.ico).*)"],
};
