import { getCurrentOrganization } from "@/lib/auth";

export default async function CustomersPage() {
  const { supabase, membership } = await getCurrentOrganization();
  const { data, error } = await supabase
    .from("customers")
    .select("id,name,document,email,phone,active")
    .eq("organization_id", membership.organization_id)
    .order("name")
    .limit(200);
  if (error) throw error;

  return (
    <section className="stack">
      <div><h1>Clientes</h1><p className="muted">Cadastro mínimo necessário para cobrança.</p></div>
      <div className="card table-wrap">
        {data?.length ? <table><thead><tr><th>Nome</th><th>Documento</th><th>E-mail</th><th>Telefone</th></tr></thead><tbody>{data.map((c) => <tr key={c.id}><td>{c.name}</td><td>{c.document ?? "—"}</td><td>{c.email ?? "—"}</td><td>{c.phone ?? "—"}</td></tr>)}</tbody></table> : <div className="empty">Clientes aparecerão aqui após cadastro ou importação.</div>}
      </div>
    </section>
  );
}
