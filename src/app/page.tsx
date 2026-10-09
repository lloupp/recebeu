import Link from "next/link";
import { isLocalMode } from "@/lib/storage-mode";

export default function Home() {
  return (
    <main className="container hero">
      <div className="badge">{isLocalMode ? "Modo local com dados salvos" : "MVP em construção"}</div>
      <h1>Contas a receber sem virar outro ERP.</h1>
      <p>
        Importe sua planilha, veja quem está atrasado e organize a cobrança com
        histórico e métricas de recuperação.
      </p>
      <div className="row" style={{ marginTop: 28 }}>
        {isLocalMode ? <Link className="button" href="/dashboard">Abrir Recebeu local</Link> : <><Link className="button" href="/signup">Criar conta</Link><Link className="button secondary" href="/login">Entrar</Link></>}
        <Link className="button secondary" href="/demo">Demonstração fictícia</Link>
      </div>
    </main>
  );
}
