import { NextResponse, type NextRequest } from "next/server";
import { isLocalMode } from "@/lib/storage-mode";

export async function proxy(request: NextRequest) {
  if (isLocalMode) {
    // The local mode has no multi-user authentication; never serve it through
    // a public domain. The Node server is also bound to loopback by scripts.
    if (!["localhost","127.0.0.1","::1"].includes(request.nextUrl.hostname)) {
      return new NextResponse("Modo local disponível apenas neste computador.", {status: 403});
    }
    return NextResponse.next();
  }
  if (request.nextUrl.pathname === "/demo" || request.nextUrl.pathname === "/api/health") {
    return NextResponse.next();
  }
  const { updateSession } = await import("@/lib/supabase/proxy");
  return updateSession(request);
}
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
