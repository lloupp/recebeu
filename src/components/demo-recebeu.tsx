"use client";

import { useMemo, useState } from "react";
import { agingBucket, effectiveStatus, sumByAging, sumByStatus, type ReceivableLike } from "@/lib/domain/receivables";

type DemoItem = ReceivableLike & { id: string; customer: string; description: string };
type DemoFilter = "all" | "overdue" | "pending" | "paid";
const TODAY = "2026-10-08";

const examples: DemoItem[] = [
  { id: "DEMO-001", customer: "Empresa Fictícia Alfa", description: "Mensalidade", amount: 1200.50, due_date: "2026-09-01", status: "pending" },
  { id: "DEMO-002", customer: "Empresa Fictícia Beta", description: "Consultoria", amount: 780, due_date: "2026-09-20", status: "pending" },
  { id: "DEMO-003", customer: "Empresa Fictícia Gama", description: "Assinatura", amount: 340, due_date: "2026-09-30", status: "pending" },
  { id: "DEMO-004", customer: "Empresa Fictícia Delta", description: "Projeto entregue", amount: 2250, due_date: "2026-10-08", status: "pending" },
  { id: "DEMO-005", customer: "Empresa Fictícia Épsilon", description: "Mensalidade", amount: 490.90, due_date: "2026-10-15", status: "pending" },
  { id: "DEMO-006", customer: "Empresa Fictícia Zeta", description: "Serviço mensal", amount: 199, due_date: "2026-10-25", status: "pending" },
  { id: "DEMO-007", customer: "Empresa Fictícia Eta", description: "Contrato antigo", amount: 1500, due_date: "2026-08-05", status: "pending" },
  { id: "DEMO-008", customer: "Empresa Fictícia Teta", description: "Parcela anterior", amount: 89.90, due_date: "2026-07-14", status: "pending" },
];
const buckets = [
  ["not_due", "A vencer / hoje"], ["1_7", "1–7 dias"],
  ["8_30", "8–30 dias"], ["31_60", "31–60 dias"],
  ["61_90", "61–90 dias"], ["90_plus", "Mais de 90 dias"],
] as const;

const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const date = (v: string) => v.split("-").reverse().join("/");
const labels = { pending: "A vencer", overdue: "Vencido", paid: "Recebido", cancelled: "Cancelado" };

export function DemoRecebeu() {
  const [items, setItems] = useState<DemoItem[]>(examples);
  const [filter, setFilter] = useState<DemoFilter>("all");
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");

  const totals = useMemo(() => sumByStatus(items, TODAY), [items]);
  const aging = useMemo(() => sumByAging(items, TODAY), [items]);
  const filtered = items.filter(item => {
    const status = effectiveStatus(item, TODAY);
    return (filter === "all" || filter === status) &&
      (item.customer.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR")) ||
       item.id.toLowerCase().includes(search.toLowerCase()));
  });

  function markPaid(id: string) {
    setItems(current => current.map(item =>
      item.id === id ? { ...item, status: "paid", paid_at: "2026-10-08T12:00:00Z" } : item
    ));
    setNotice("Pagamento fictício registrado apenas nesta demonstração.");
  }
  function reset() {
    setItems(examples);
    setFilter("all");
    setSearch("");
    setNotice("Cenário fictício restaurado.");
  }

  return (
    <section className="stack" aria-label="Demonstração do Recebeu">
      <div className="card demo-disclaimer">
        <strong>Ambiente demonstrativo · dados 100% fictícios</strong>
        <p>Esta tela usa um cenário fixo de 08/10/2026. Você pode simular recebimentos e filtros, mas nenhuma operação é salva, nenhuma mensagem é enviada e não há conexão com contas bancárias ou clientes reais.</p>
      </div>
      <div className="demo-titlebar">
        <div><h1>Visão da carteira</h1><p className="muted">Empresa de demonstração · posição fictícia em 08/10/2026</p></div>
        <button type="button" onClick={reset} className="button secondary">Restaurar cenário</button>
      </div>
      {notice && <div className="success" role="status">{notice}</div>}
      <div className="grid demo-metrics">
        <article className="card metric"><div className="label">Em aberto</div><div className="value">{brl(totals.pending + totals.overdue)}</div></article>
        <article className="card metric"><div className="label">Vencido</div><div className="value">{brl(totals.overdue)}</div></article>
        <article className="card metric"><div className="label">A vencer</div><div className="value">{brl(totals.pending)}</div></article>
        <article className="card metric"><div className="label">Recebido</div><div className="value">{brl(totals.paid)}</div></article>
      </div>
      <div className="card stack">
        <div><h2>Tempo de atraso</h2><p className="muted">Distribuição dos valores ainda não recebidos.</p></div>
        <div className="grid demo-aging">
          {buckets.map(([key, label]) => (
            <div className="demo-age" key={key}>
              <span className="muted">{label}</span>
              <strong>{brl(aging[key])}</strong>
            </div>
          ))}
        </div>
      </div>
      <div className="card stack">
        <div className="demo-titlebar">
          <div><h2>Recebíveis</h2><p className="muted">Simule a confirmação de pagamento para atualizar os totais.</p></div>
          <span className="muted">{filtered.length} título(s)</span>
        </div>
        <div className="demo-controls">
          <label>Filtrar
            <select value={filter} onChange={event => setFilter(event.target.value as DemoFilter)}>
              <option value="all">Todos</option>
              <option value="overdue">Vencidos</option>
              <option value="pending">A vencer</option>
              <option value="paid">Recebidos</option>
            </select>
          </label>
          <label>Buscar cliente ou código
            <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Empresa fictícia..." />
          </label>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Cliente</th><th>Descrição</th><th>Vencimento</th><th>Valor</th><th>Situação</th><th>Ação de teste</th></tr></thead>
            <tbody>
              {filtered.map(item => {
                const status = effectiveStatus(item, TODAY);
                return <tr key={item.id}>
                  <td>{item.customer}<div className="muted">{item.id}</div></td>
                  <td>{item.description}</td><td>{date(item.due_date)}</td>
                  <td>{brl(item.amount)}</td>
                  <td><span className={"badge " + status}>{labels[status]}</span></td>
                  <td>{status === "paid" ? <span className="muted">Simulado</span> :
                    <button type="button" className="button secondary" onClick={() => markPaid(item.id)}>Simular recebimento</button>}</td>
                </tr>;
              })}
            </tbody>
          </table>
          {filtered.length === 0 && <p className="empty">Nenhum título corresponde ao filtro.</p>}
        </div>
        <p className="muted">Indicadores simulados a partir dos dados acima. No produto real, pagamentos exigem autorização e geram auditoria.</p>
      </div>
    </section>
  );
}
