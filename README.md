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

## Fluxo de recebimento manual (branch de evolução)

1. Importe os recebíveis e confira o dashboard de faixas de atraso.
2. Em Recebíveis, confirme apenas pagamentos efetivamente conciliados.
3. Marcar recebido registra o título como pago, insere o lançamento em
   payments e escreve uma trilha em audit_logs, tudo em uma transação.
4. Apenas owner/admin/operator podem registrar; viewer permanece somente leitura.
5. Reimportações que tentem alterar pagamentos confirmados são bloqueadas.
6. Ainda não existe envio automático de cobranças, estorno auditado ou
   integração bancária. A coluna "recuperado após cobrança" permanece sem cálculo.

**Obrigatório no banco:** aplique a migração
supabase/migrations/0002_record_receivable_payment.sql no projeto Supabase
correspondente antes de usar a ação de pagamento. Não aplique em outro projeto.

**Limites atuais:** dashboard até 5.000 títulos e lista até 200 títulos.
Não anuncie o produto como pronto para carteiras maiores antes de implementar
paginação/consulta agregada e confirmar permissões, RLS, migrações e fluxos reais.

## Demonstração sem banco

Acesse a rota /demo com npm run dev. Ela mostra apenas empresas fictícias
e uma carteira congelada em 08/10/2026. Permite filtrar, pesquisar e simular
pagamento em memória no navegador. Não cria clientes, não grava pagamentos,
não envia cobranças e não depende das credenciais Supabase.

A rota /demo é código de demonstração, **não equivale à aplicação autenticada**.
Qualquer hospedagem externa destinada a pilotos deverá estar protegida
por autenticação de implantação e ser validada antes de compartilhar o link.

## CI: teste de banco descartável

O job database-integration inicia PostgreSQL 17 temporário no GitHub Actions,
carrega um substituto de autenticação apenas para testes, executa as migrações
0001 e 0002 e testa isolamento entre organizações, papéis, duplicidade de
pagamento, proteção contra importação e auditoria.

Esse job não conecta a projeto Supabase real nem testa fluxos completos do
Auth/SSR/browser. Use um ambiente Supabase **dedicado ao Recebeu** e teste com
dois usuários reais e duas organizações antes de liberar um piloto.

## Uso real no computador (sem Supabase)

**Modo padrão:** SQLite local. Não precisa criar conta, projeto Supabase, Docker,
chave API ou conexão com a internet depois que as dependências forem instaladas.
O modo local é individual e não deve ser aberto na rede.

Recomendado Node.js 24 LTS (ou Node.js >=22.13, onde node:sqlite ainda
era experimental), Git e npm instalados.

    git clone https://github.com/lloupp/recebeu.git
    cd recebeu
    git switch feat/manual-payment-and-aging-20261008
    npm ci
    npm run dev

Abra http://127.0.0.1:3000 (Dashboard, Clientes, Recebíveis e Importações).
Os scripts dev e start escutam SOMENTE no loopback 127.0.0.1.

O arquivo de banco é criado na primeira operação no diretório do usuário:

- Linux/macOS: ~/.recebeu/recebeu.sqlite
- Windows: %USERPROFILE%\.recebeu\recebeu.sqlite

Para usar outra pasta, defina RECEBEU_DATA_DIR antes de iniciar; a pasta deve
ser gravável e não deve estar em diretórios públicos ou compartilhados.

**Backup:** feche o Recebeu antes de copiar o banco. Se a aplicação estiver
aberta, transações podem estar também nos arquivos SQLite WAL. Com a aplicação
parada, copie a pasta .recebeu inteira para um local seguro. Restaurar exige
fechar o app e devolver os arquivos originais na mesma pasta. Não apague
o banco ao atualizar o código ou as dependências.

Este modo usa UUIDs para clientes/recebíveis e armazenamento monetário em
centavos inteiros, com trilha de auditoria para importações e pagamentos.
O importador aceita CSV/XLSX; atualiza por ID externo se ainda não pago.
Pagamentos confirmados não podem ser sobrescritos por reimportação.
Não há conciliação parcial/estorno nem cobrança automática.

**Segurança:** não execute npm run dev/start em interfaces de rede nem coloque
o Recebeu atrás de túnel/reverse proxy. O modo local não tem autenticação,
perfis ou isolamento multiusuário. Proteja a sessão e os arquivos do sistema
operacional. Antes de trabalhar em equipe, migre para uma solução com
autenticação e isolamento de organizações revisados.

## Migração futura para Supabase

O backend hospedado original foi preservado. A variável
RECEBEU_STORAGE=supabase seleciona o fluxo com Supabase Auth/Postgres (exige
NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY e migrações).
Não basta alterar a variável sobre dados existentes: será necessária uma
rotina explícita de exportação/transformação dos registros SQLite, validação
de totais, IDs, pagamentos e auditoria e a configuração de acessos por empresa.
Não sincroniza automaticamente. O banco local continua intacto.

Os testes de UI local persistente estão em tests/e2e/local-smoke.mjs e executam
com um banco temporário no GitHub Actions, sem Supabase.
