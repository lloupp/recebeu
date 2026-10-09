import { NextResponse } from "next/server";

const LOOPBACK_HOSTS = ["localhost", "127.0.0.1", "[::1]", "::1"];

/**
 * Restrict local-mode write requests to a loopback origin. Next can normalize
 * incoming request.url to localhost while the browser uses 127.0.0.1.
 * Both are safe if the protocol and port match.
 * This is not user authentication; never bind the server to a network NIC.
 */
export function requireLocalOrigin(request: Request): NextResponse | null {
  const dest = new URL(request.url);
  if (!LOOPBACK_HOSTS.includes(dest.hostname)) {
    return NextResponse.json({ error:"Modo local: acesso externo bloqueado." }, {status:403});
  }
  const originHeader = request.headers.get("origin");
  if (originHeader) {
    let source: URL;
    try { source = new URL(originHeader); }
    catch { return NextResponse.json({error:"Origem inválida."},{status:403}); }
    if (source.protocol !== dest.protocol
      || !LOOPBACK_HOSTS.includes(source.hostname)
      || source.port !== dest.port
      || source.username || source.password) {
      return NextResponse.json({error:"Origem não autorizada."},{status:403});
    }
  }
  if (request.headers.get("sec-fetch-site")==="cross-site") {
    return NextResponse.json({error:"Requisição externa bloqueada."},{status:403});
  }
  return null;
}
