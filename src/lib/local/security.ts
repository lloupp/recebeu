import { NextResponse } from "next/server";

/**
 * This is NOT an authentication system. In local mode the Next server must
 * be bound to loopback. This additional check reduces browser-origin CSRF.
 */
export function requireLocalOrigin(request: Request): NextResponse | null {
  const dest = new URL(request.url);
  const hostname = dest.hostname;
  if (!["localhost", "127.0.0.1", "[::1]", "::1"].includes(hostname)) {
    return NextResponse.json({error:"Modo local: acesso externo bloqueado."},{status:403});
  }
  const origin = request.headers.get("origin");
  if (origin && origin !== dest.origin) {
    return NextResponse.json({error:"Origem não autorizada."},{status:403});
  }
  const site = request.headers.get("sec-fetch-site");
  if (site === "cross-site") {
    return NextResponse.json({error:"Requisição externa bloqueada."},{status:403});
  }
  return null;
}
