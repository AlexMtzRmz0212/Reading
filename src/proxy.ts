import { NextResponse, type NextRequest } from "next/server";
import { COOKIE, gateEnabled, isPublicPath, sameOrigin, verifySession } from "./lib/auth";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Writes must come from this site’s own pages, signed in or not (this covers login and logout too).
  if (pathname.startsWith("/api/") && !sameOrigin(request)) {
    return NextResponse.json({ error: "Cross-site request refused" }, { status: 403 });
  }

  if (!gateEnabled()) return NextResponse.next();
  if (isPublicPath(pathname)) return NextResponse.next();
  if (await verifySession(request.cookies.get(COOKIE)?.value)) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon).*)"],
};
