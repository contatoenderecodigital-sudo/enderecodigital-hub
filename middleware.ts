import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "./lib/session";

// Rotas publicas (sem sessao).
const PUBLIC = [
  "/login",
  "/api/login",
  "/api/bootstrap",
  "/api/health",
  "/api/lead-capture",
  "/api/whatsapp/webhook",
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    /\.(png|svg|jpg|jpeg|gif|ico|webp|avif|txt|xml|json|woff2?|ttf|otf|map)$/i.test(pathname) ||
    PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/"))
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;

  if (!session) {
    // Prefetch do Next e credential-less (Chrome nao manda o cookie). Se a gente
    // redirecionar o prefetch pro /login, o router CACHEIA esse redirect e o clique
    // real vai parar no /login. Entao: nao redireciona prefetch, responde 204 vazio.
    const secPurpose = req.headers.get("sec-purpose") || "";
    const ehPrefetch =
      req.headers.get("next-router-prefetch") === "1" ||
      req.headers.get("next-router-segment-prefetch") !== null ||
      secPurpose.includes("prefetch") ||
      req.headers.get("purpose") === "prefetch" ||
      req.headers.get("x-purpose") === "prefetch";
    if (ehPrefetch) {
      return new NextResponse(null, { status: 204 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Console do owner: so owner_plataforma.
  if (pathname.startsWith("/owner") && session.papel !== "owner_plataforma") {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // GROOW OS (operacao + api/admin): so owner_plataforma.
  if (
    (pathname.startsWith("/operacao") || pathname.startsWith("/api/admin")) &&
    session.papel !== "owner_plataforma"
  ) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png).*)"],
};
