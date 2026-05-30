import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/session-cookie-name";

const PUBLIC_PATHS: ReadonlyArray<string | RegExp> = [
  "/",
  "/login",
  "/legacy",
  // The 2D Khmer authoring studio + its stateless interview API are open: they
  // touch no protected data. The gated actions (3D generation / deploy) still
  // require a Telegram session at the API layer.
  "/studio",
  /^\/api\/interview$/,
  /^\/api\/auth\/telegram(\/.*)?$/,
  /^\/api\/auth\/init$/,
  /^\/api\/auth\/poll$/,
  /^\/api\/auth\/logout$/,
  /^\/api\/admin-link$/,
  /^\/api\/health$/,
  /^\/api\/telegram\/webhook$/,
  /^\/_next\//,
  /^\/favicon\.ico$/,
  /^\/public\//,
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) =>
    typeof p === "string" ? p === pathname : p.test(pathname),
  );
}

/**
 * Strict interceptor that cuts off unauthenticated attempts immediately with a
 * deterministic JSON security exception (for API routes) or a 302 redirect to
 * /login (for HTML routes).
 *
 * NOTE: middleware only enforces the *presence* of a signed cookie. Full
 * cryptographic + DB lookup happens in `resolveSessionFromCookieStore()` inside
 * server components / route handlers, which can use Node-only APIs.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  const cookie = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (cookie && cookie.includes(".")) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return new NextResponse(
      JSON.stringify({
        error: {
          code: "AUTH_REQUIRED",
          message: "Authentication required. Sign in via Telegram to obtain a session.",
          path: pathname,
          timestamp: new Date().toISOString(),
        },
      }),
      {
        status: 401,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store",
        },
      },
    );
  }

  const redirect = req.nextUrl.clone();
  redirect.pathname = "/login";
  redirect.searchParams.set("next", pathname);
  return NextResponse.redirect(redirect);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
