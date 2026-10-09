import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  // Public, synthetic demo and health check never create a Supabase client.
  // The real customer-facing routes continue through session verification.
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
