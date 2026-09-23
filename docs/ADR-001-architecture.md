# ADR-001 — Fundação do Recebeu

## Status
Aceito para o MVP.

## Contexto
O produto começa como uma camada especializada em contas a receber para empresas que usam planilhas ou exportações de ERP. Não será ERP, CRM nem gateway de pagamento.

## Decisões

1. Next.js App Router no frontend e backend web.
2. PostgreSQL no Supabase como fonte de verdade.
3. Supabase Auth para identidade.
4. `organization_members` define associação e papel; nenhum dado de negócio depende somente de autenticação.
5. RLS em todas as tabelas expostas.
6. `organization_id` obrigatório em toda entidade de negócio.
7. Valores monetários são `numeric(14,2)`, nunca float.
8. Datas de vencimento são `date`; eventos usam `timestamptz`.
9. Imports passam por parse → map → validate → preview → commit.
10. Cobrança automática só entra depois de idempotência, opt-out, pausa e histórico estarem definidos.

## Consequências

O modelo é um pouco mais rigoroso no início, mas reduz risco de vazamento entre tenants e evita retrabalho quando o produto ganhar integrações.
