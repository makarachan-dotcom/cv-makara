import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = new Set<string>(["/", "/login", "/auth/telegram", "/api/auth/telegram"]);
const PROTECTED_PREFIXES = ["/workspace", "/dashboard", "/cv", "/account"];

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (pathname.startsWith("/_next")) return true;
  if (pathname.startsWith("/api/auth")) return true;
  if (pathname.startsWith("/static")) return true;
  if (/\.(png|jpg|jpeg|svg|webp|ico|css|js|map|woff2?)$/i.test(pathname)) return true;
  return false;
}

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function middleware(req: NextRequest): NextResponse {
  const { pathname, search } = req.nextUrl;
  const token = req.cookies.get("makara_session")?.value ?? null;
  const isAuthed = Boolean(token);

  // Never redirect static or already-public assets — kills the bounce loop.
  if (isPublic(pathname)) {
    // Authed user visiting /login → send them home ONCE (no recursion).
    if (isAuthed && (pathname === "/login" || pathname === "/")) {
      const url = req.nextUrl.clone();
      url.pathname = "/workspace";
      url.search = "";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // Protected route, no session → bounce to /login with return-to.
  if (isProtected(pathname) && !isAuthed) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
