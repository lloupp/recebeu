# Segurança do MVP

- Nunca expor `service_role` no browser.
- Não usar `user_metadata` para autorização.
- Toda tabela do schema público criada pelo produto usa RLS.
- Políticas exigem associação à organização.
- UPDATE inclui `USING` e `WITH CHECK`.
- Views futuras devem usar `security_invoker = true` ou ficar fora de schemas expostos.
- Imports não armazenam o arquivo original por padrão; apenas metadados e linhas aprovadas.
- Logs de auditoria não devem conter senhas, tokens, arquivos completos ou dados financeiros além do necessário para rastreabilidade.
