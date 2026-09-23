import Link from "next/link";
import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="centered">
      <section className="card auth-card stack">
        <div>
          <div className="badge">Recebeu</div>
          <h1>Entrar</h1>
          <p className="muted">Acesse sua carteira de recebíveis.</p>
        </div>
        {error ? <div className="error">{error}</div> : null}
        <form action={login} className="stack">
          <label>E-mail<input required name="email" type="email" autoComplete="email" /></label>
          <label>Senha<input required name="password" type="password" autoComplete="current-password" minLength={8} /></label>
          <button className="button" type="submit">Entrar</button>
        </form>
        <p className="muted">Ainda não possui conta? <Link href="/signup"><strong>Criar conta</strong></Link></p>
      </section>
    </main>
  );
}
