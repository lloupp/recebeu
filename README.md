# Recebeu

Micro-SaaS B2B para contas a receber de pequenas e médias empresas brasileiras.

> Importe sua planilha. Veja quem está atrasado. Organize a cobrança. Meça quanto recuperou.

## Escopo da primeira milestone

- autenticação com Supabase Auth;
- organizações multi-tenant;
- RLS como fronteira de isolamento;
- clientes;
- contas a receber;
- aging e dashboard inicial;
- importação CSV/XLSX com preview e validação;
- audit log;
- base preparada para regras de cobrança posteriores.

## Stack

- Next.js 16 + TypeScript;
- PostgreSQL/Supabase;
- Supabase Auth + RLS;
- Vercel para o app web.

## Desenvolvimento

1. Crie um projeto no Supabase.
2. Copie `.env.example` para `.env.local` e preencha as variáveis.
3. Aplique `supabase/migrations/0001_foundation.sql`.
4. Instale dependências com `npm install`.
5. Rode `npm run dev`.

## Segurança

O frontend nunca recebe a chave `service_role`. Todas as tabelas de negócio têm RLS e o acesso depende da associação do usuário à organização.
