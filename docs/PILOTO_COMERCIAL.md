# Recebeu — roteiro do primeiro piloto comercial

## Hipótese
Uma micro ou pequena empresa que hoje usa planilhas para controlar contas a
receber valorizará uma tela única de títulos vencidos e o registro auditável
de pagamentos confirmados.

## Cliente inicial
- Prestadores de serviços recorrentes com 20 a 500 títulos mensais.
- Usuário principal: dono ou financeiro da empresa.
- Dor central: descobrir atrasos e atualizar planilhas manualmente.

## Promessa verificável
"Importe a planilha, enxergue os vencidos por faixa e registre o que já recebeu."
Não prometer envio automático, recuperação comprovada de valores ou integração
bancária: esses recursos ainda não existem.

## Hipótese comercial (não é validação de mercado)
- Piloto assistido de 30 dias: oferecer a poucos clientes com escopo escrito.
- Cobrança para testar: R$ 49/mês básico, R$ 99/mês com suporte/implantação leve.
- Medir custo de hospedagem, suporte, importações e desistências antes de fixar preços.
- Billing e contratação eletrônica ainda precisam ser implementados.

## Critérios antes de usar dados reais
1. Ter projeto Supabase exclusivo do Recebeu e migrations 0001 + 0002 aplicadas.
2. Passar CI e testes funcionais de login, organizações, roles e importação.
3. Testar que usuários de empresas A e B não acessam dados uma da outra.
4. Confirmar que um pagamento duplicado não gera dois lançamentos.
5. Confirmar que reimportar título pago não desfaz o pagamento.
6. Definir política LGPD: finalidade, base legal, retenção, exclusão e controles de acesso.
7. Definir quem fará backups, suporte e atendimento a incidentes.
8. Não usar números ou contatos reais em apresentações sem autorização.

## Demonstração segura
Importar o arquivo examples/recebiveis_demo.csv, com clientes totalmente
fictícios. Para coluna ID, mapear "ID do recebível"; para Vencimento,
mapear "Vencimento". A primeira importação exige inspeção do preview.

## Checklist de teste manual
- [ ] Sign-up -> onboarding -> dashboard, sem credenciais hardcoded.
- [ ] Importar CSV demo e conferir oito recebíveis e os totais.
- [ ] Marcar um título vencido como recebido.
- [ ] Ver redução do valor vencido e aumento do valor recebido no dashboard.
- [ ] Repetir registro do mesmo título: não criar duplicidade de pagamento.
- [ ] Viewer não visualiza botão e não consegue invocar RPC.
- [ ] Outro tenant não consegue ler nem registrar títulos da primeira empresa.
- [ ] Reimportar CSV com pagamento registrado: operação bloqueada com rollback.
- [ ] Exibir mensagens úteis em falhas de importação e confirmar que não houve
      alteração parcial dos dados.

## Próximas entregas sugeridas
1. Busca, filtros e paginação server-side da carteira.
2. Registro de interações de cobrança, sem envio automático inicialmente.
3. Conciliação parcial, estorno/correção auditados e valores recuperados.
4. Fluxo de convite para equipe da empresa.
5. Cobrança de assinatura e limites de planos, após pilotos.
