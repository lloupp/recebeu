import { getCurrentOrganization } from "@/lib/auth";
import { effectiveStatus } from "@/lib/domain/receivables";

function brl(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export default async function ReceivablesPage() {
  const { supabase, membership } = await getCurrentOrganization();
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("receivables")
    .select("id,amount,due_date,status,paid_at,description,customers(name)")
    .eq("organization_id", membership.organization_id)
    .order("due_date", { ascending: true })
    .limit(200);
  if (error) throw error;

  return (
    <section className="stack">
      <div><h1>Recebíveis</h1><p className="muted">Pendentes, vencidos e pagos.</p></div>
      <div className="card table-wrap">
        {data?.length ? <table>
          <thead><tr><th>Cliente</th><th>Descrição</th><th>Vencimento</th><th>Valor</th><th>Status</th></tr></thead>
          <tbody>{data.map((item) => {
            const status = effectiveStatus({ amount: Number(item.amount), due_date: item.due_date, status: item.status, paid_at: item.paid_at }, today);
            const customer = item.customers as unknown as { name?: string } | null;
            return <tr key={item.id}><td>{customer?.name ?? "—"}</td><td>{item.description ?? "—"}</td><td>{new Date(`${item.due_date}T00:00:00`).toLocaleDateString("pt-BR")}</td><td>{brl(Number(item.amount))}</td><td><span className={`badge ${status}`}>{status}</span></td></tr>;
          })}</tbody>
        </table> : <div className="empty">Nenhum recebível. Comece importando uma planilha.</div>}
      </div>
    </section>
  );
}
