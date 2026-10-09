import { getCurrentOrganization } from "@/lib/auth";
import { isLocalMode } from "@/lib/storage-mode";
import { createLocalCustomerAction } from "./actions";
export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  if (isLocalMode) {
    const { listCustomers } = await import("@/lib/local/store");
    const customers = listCustomers();
    return <section className="stack">
      <div><h1>Clientes</h1><p className="muted">Clientes salvos no banco local deste computador.</p></div>
      <form action={createLocalCustomerAction} className="card stack">
        <h2>Novo cliente</h2>
        <div className="grid demo-controls">
          <label>Nome ou razão social *<input required name="name" minLength={1} maxLength={200} /></label>
          <label>CPF/CNPJ (opcional)<input name="document" maxLength={32}/></label>
          <label>E-mail<input name="email" type="email"/></label>
          <label>Telefone<input name="phone" maxLength={32}/></label>
        </div>
        <div><button className="button" type="submit">Salvar cliente</button></div>
      </form>
      <div className="card table-wrap">
        {customers.length ? <table><thead><tr><th>Cliente</th><th>Documento</th><th>E-mail</th><th>Telefone</th></tr></thead><tbody>
          {customers.map(c=><tr key={c.id}><td>{c.name}</td><td>{c.document??"—"}</td><td>{c.email??"—"}</td><td>{c.phone??"—"}</td></tr>)}
        </tbody></table> : <div className="empty">Cadastre seu primeiro cliente.</div>}
      </div>
    </section>;
  }
  const { supabase, membership } = await getCurrentOrganization();
  const { data, error } = await supabase
    .from("customers").select("id,name,document,email,phone,active")
    .eq("organization_id", membership.organization_id).order("name").limit(200);
  if (error) throw error;
  return <section className="stack">
    <div><h1>Clientes</h1><p className="muted">Cadastro de clientes da organização.</p></div>
    <div className="card table-wrap">{data?.length ? <table>
      <thead><tr><th>Nome</th><th>Documento</th><th>E-mail</th><th>Telefone</th></tr></thead>
      <tbody>{data.map(c=><tr key={c.id}><td>{c.name}</td><td>{c.document??"—"}</td><td>{c.email??"—"}</td><td>{c.phone??"—"}</td></tr>)}</tbody>
    </table> : <div className="empty">Clientes aparecerão aqui após importação.</div>}</div>
  </section>;
}
