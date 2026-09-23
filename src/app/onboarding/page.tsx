import { createOrganization } from "./actions";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="centered">
      <section className="card auth-card stack">
        <div>
          <div className="badge">Passo 1 de 2</div>
          <h1>Crie sua empresa</h1>
          <p className="muted">Depois você poderá importar a primeira planilha.</p>
        </div>
        {error ? <div className="error">{error}</div> : null}
        <form action={createOrganization} className="stack">
          <label>Nome da empresa<input name="name" required minLength={2} /></label>
          <label>CNPJ <span className="muted">(opcional no MVP)</span><input name="document" inputMode="numeric" /></label>
          <button type="submit" className="button">Continuar</button>
        </form>
      </section>
    </main>
  );
}
