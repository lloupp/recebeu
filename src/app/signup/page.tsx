import Link from "next/link";
import { signup } from "./actions";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const { error, success } = await searchParams;
  return (
    <main className="centered">
      <section className="card auth-card stack">
        <div>
          <div className="badge">Recebeu</div>
          <h1>Criar conta</h1>
          <p className="muted">A primeira empresa será criada no próximo passo.</p>
        </div>
        {error ? <div className="error">{error}</div> : null}
        {success ? <div className="success">{success}</div> : null}
        <form action={signup} className="stack">
          <label>E-mail<input required name="email" type="email" autoComplete="email" /></label>
          <label>Senha<input required name="password" type="password" autoComplete="new-password" minLength={8} /></label>
          <button className="button" type="submit">Criar conta</button>
        </form>
        <p className="muted">Já possui conta? <Link href="/login"><strong>Entrar</strong></Link></p>
      </section>
    </main>
  );
}
