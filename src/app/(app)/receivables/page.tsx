import { getCurrentOrganization } from "@/lib/auth";
import { localToday } from "@/lib/domain/dates";
import { effectiveStatus } from "@/lib/domain/receivables";
import { RecordPaymentForm } from "@/components/record-payment-form";
import { createLocalReceivableAction } from "./create-action";
import { isLocalMode } from "@/lib/storage-mode";

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
  if (isLocalMode) {
    const {listReceivables,listCustomers}=await import("@/lib/local/store");
    const rows=listReceivables(),customers=listCustomers();
    const today=localToday(new Date(),"America/Sao_Paulo");
    return <section className="stack">
      <div><h1>Recebíveis · Local</h1><p className="muted">Cadastre títulos e registre pagamentos com histórico permanente.</p></div>
      <form action={createLocalReceivableAction} className="card stack">
        <h2>Novo recebível</h2>
        <div className="grid demo-controls">
          <label>Cliente *<select required name="customer_id" defaultValue="">
            <option value="" disabled>Selecione um cliente</option>
            {customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
          </select></label>
          <label>Descrição<input name="description" maxLength={200}/></label>
          <label>Valor (R$) *<input required name="amount" placeholder="250,00"/></label>
          <label>Vencimento *<input required type="date" name="due_date" /></label>
        </div>
        <div className="row"><button disabled={!customers.length} className="button" type="submit">Salvar título</button>
          {!customers.length?<a className="button secondary" href="/customers">Cadastrar cliente primeiro</a>:null}</div>
      </form>
      <div className="card table-wrap">
        {rows.length?<table><thead><tr><th>Cliente</th><th>Descrição</th><th>Vencimento</th><th>Valor</th><th>Status</th><th>Ação</th></tr></thead>
        <tbody>{rows.map(item=>{
          const status=effectiveStatus(item,today);
          return <tr key={item.id}><td>{item.customer_name}</td><td>{item.description??"—"}</td><td>{item.due_date.split("-").reverse().join("/")}</td>
            <td>{brl(item.amount)}</td><td><span className={"badge "+status}>{statusLabels[status]}</span></td>
            <td>{status==="pending"||status==="overdue"
              ?<RecordPaymentForm id={item.id} customerName={item.customer_name} amount={brl(item.amount)} />
              :<span className="muted">—</span>}</td></tr>;
        })}</tbody></table>:<div className="empty">Nenhum recebível cadastrado.</div>}
      </div>
    </section>;
  }
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
