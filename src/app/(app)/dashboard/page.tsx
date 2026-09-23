import { getCurrentOrganization } from "@/lib/auth";
import { sumByStatus, type ReceivableLike } from "@/lib/domain/receivables";

function brl(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export default async function DashboardPage() {
  const { supabase, membership } = await getCurrentOrganization();
  const organizationId = membership.organization_id;
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("receivables")
    .select("amount,due_date,status,paid_at")
    .eq("organization_id", organizationId)
    .neq("status", "cancelled")
    .limit(5000);

  if (error) throw error;
  const totals = sumByStatus((data ?? []).map((r) => ({ ...r, amount: Number(r.amount) })) as ReceivableLike[], today);
  const open = totals.pending + totals.overdue;

  return (
    <section className="stack">
      <div><h1>Dashboard</h1><p className="muted">Visão simples da carteira atual.</p></div>
      <div className="grid metrics">
        <article className="card metric"><div className="label">A receber</div><div className="value">{brl(open)}</div></article>
        <article className="card metric"><div className="label">Vencido</div><div className="value">{brl(totals.overdue)}</div></article>
        <article className="card metric"><div className="label">Recebido</div><div className="value">{brl(totals.paid)}</div></article>
        <article className="card metric"><div className="label">Recuperado após cobrança</div><div className="value">—</div></article>
      </div>
      <div className="card"><strong>Próxima etapa</strong><p className="muted">Importe uma planilha e valide os dados antes de ativarmos qualquer automação de cobrança.</p></div>
    </section>
  );
}
