import Link from "next/link";

export default function Home() {
  return (
    <main className="container hero">
      <div className="badge">MVP em construção</div>
      <h1>Contas a receber sem virar outro ERP.</h1>
      <p>
        Importe sua planilha, veja quem está atrasado e organize a cobrança com
        histórico e métricas de recuperação.
      </p>
      <div className="row" style={{ marginTop: 28 }}>
        <Link className="button" href="/signup">Criar conta</Link>
        <Link className="button secondary" href="/login">Entrar</Link>
      </div>
    </main>
  );
}
