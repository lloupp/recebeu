import Link from "next/link";
import { getCurrentOrganization } from "@/lib/auth";
import { localToday } from "@/lib/domain/dates";
import { sumByAging, sumByStatus, type ReceivableLike } from "@/lib/domain/receivables";

function brl(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

const bands = [
  { key: "not_due", label: "A vencer ou vence hoje" },
  { key: "1_7", label: "1 a 7 dias de atraso" },
  { key: "8_30", label: "8 a 30 dias de atraso" },
  { key: "31_60", label: "31 a 60 dias de atraso" },
  { key: "61_90", label: "61 a 90 dias de atraso" },
  { key: "90_plus", label: "Mais de 90 dias de atraso" },
] as const;

export default async function DashboardPage() {
  const { supabase, membership } = await getCurrentOrganization();
  const organization = membership.organizations as unknown as { timezone?: string } | null;
  const today = localToday(new Date(), organization?.timezone ?? "America/Sao_Paulo");
  const { data, error } = await supabase
    .from("receivables")
    .select("amount,due_date,status,paid_at")
    .eq("organization_id", membership.organization_id)
    .neq("status", "cancelled")
    .limit(5000);

  if (error) throw error;
  const receivables = (data ?? []).map((r) => ({ ...r, amount: Number(r.amount) })) as ReceivableLike[];
  const totals = sumByStatus(receivables, today);
  const aging = sumByAging(receivables, today);
  const open = totals.pending + totals.overdue;

  return (
    <section className="stack">
      <div>
        <h1>Dashboard</h1>
        <p className="muted">Resumo da carteira em {today.split("-").reverse().join("/")}.</p>
      </div>
      <div className="grid metrics">
        <article className="card metric"><div className="label">A receber</div><div className="value">{brl(open)}</div></article>
        <article className="card metric"><div className="label">Vencido</div><div className="value">{brl(totals.overdue)}</div></article>
        <article className="card metric"><div className="label">Recebido (na carteira)</div><div className="value">{brl(totals.paid)}</div></article>
        <article className="card metric"><div className="label">Recuperado após cobrança</div><div className="value">—</div></article>
      </div>
      <div className="card">
        <h2>Envelhecimento da carteira</h2>
        <p className="muted">Valores em aberto por tempo de atraso. Pagos e cancelados não entram neste quadro.</p>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Faixa</th><th>Valor em aberto</th></tr></thead>
            <tbody>
              {bands.map((band) => (
                <tr key={band.key}><td>{band.label}</td><td>{brl(aging[band.key])}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {receivables.length === 5000 ? (
        <div className="error" role="status">
          O resumo pode estar incompleto: consulta limitada a 5.000 títulos. Para carteiras maiores, será necessária agregação no banco.
        </div>
      ) : null}
      <div className="card stack">
        <strong>Próximo passo</strong>
        <p className="muted">Importe os recebíveis, confira os vencidos e registre pagamentos confirmados. O envio de cobranças ainda não é automático.</p>
        <div className="row">
          <Link className="button" href="/receivables">Ver recebíveis</Link>
          <Link className="button secondary" href="/imports">Importar planilha</Link>
        </div>
      </div>
    </section>
  );
}
