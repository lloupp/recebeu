import { getCurrentOrganization } from "@/lib/auth";
import { localToday } from "@/lib/domain/dates";
import { effectiveStatus } from "@/lib/domain/receivables";
import { RecordPaymentForm } from "@/components/record-payment-form";

function brl(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

const statusLabels = {
  pending: "A vencer",
  overdue: "Vencido",
  paid: "Recebido",
  cancelled: "Cancelado",
} as const;

export default async function ReceivablesPage() {
  const { supabase, membership } = await getCurrentOrganization();
  const org = membership.organizations as unknown as { timezone?: string } | null;
  const today = localToday(new Date(), org?.timezone ?? "America/Sao_Paulo");
  const canRecordPayment = membership.role !== "viewer";

  const { data, error } = await supabase
    .from("receivables")
    .select("id,amount,due_date,status,paid_at,description,customers(name)")
    .eq("organization_id", membership.organization_id)
    .order("due_date", { ascending: true })
    .limit(200);
  if (error) throw error;

  return (
    <section className="stack">
      <div><h1>Recebíveis</h1><p className="muted">Consulte os vencimentos e confirme pagamentos recebidos. As ações ficam registradas para auditoria.</p></div>
      <div className="card table-wrap">
        {data?.length ? <table>
          <thead><tr><th>Cliente</th><th>Descrição</th><th>Vencimento</th><th>Valor</th><th>Status</th>{canRecordPayment ? <th>Ação</th> : null}</tr></thead>
          <tbody>{data.map((item) => {
            const status = effectiveStatus({ amount: Number(item.amount), due_date: item.due_date, status: item.status, paid_at: item.paid_at }, today);
            const customer = item.customers as unknown as { name?: string } | null;
            const customerName = customer?.name ?? "cliente";
            return <tr key={item.id}>
              <td>{customer?.name ?? "—"}</td>
              <td>{item.description ?? "—"}</td>
              <td>{item.due_date.split("-").reverse().join("/")}</td>
              <td>{brl(Number(item.amount))}</td>
              <td><span className={"badge " + status}>{statusLabels[status]}</span></td>
              {canRecordPayment ? <td>
                {status === "pending" || status === "overdue"
                  ? <RecordPaymentForm id={item.id} customerName={customerName} amount={brl(Number(item.amount))} />
                  : <span className="muted">—</span>}
              </td> : null}
            </tr>;
          })}</tbody>
        </table> : <div className="empty">Nenhum recebível. Comece importando uma planilha.</div>}
      </div>
      {data?.length === 200 ? <p className="muted" role="status">Exibindo até 200 títulos. A paginação completa ainda será implementada.</p> : null}
    </section>
  );
}
