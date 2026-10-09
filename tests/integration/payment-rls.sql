\set ON_ERROR_STOP on
begin;

-- Fictional identities representing operator A, operator B and viewer A.
insert into auth.users (id) values
('11111111-1111-4111-8111-111111111111'),
('22222222-2222-4222-8222-222222222222'),
('33333333-3333-4333-8333-333333333333');

select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
set role authenticated;
select public.create_organization('Empresa fictícia A') as org_a \gset
select set_config('test.org_a', :'org_a', false);
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
select public.create_organization('Empresa fictícia B') as org_b \gset
select set_config('test.org_b', :'org_b', false);

-- Create the viewer membership as a trusted database fixture, not an app workflow.
reset role;
insert into public.organization_members(organization_id, user_id, role)
values (:'org_a'::uuid, '33333333-3333-4333-8333-333333333333', 'viewer');
set role authenticated;

-- Both organizations import a receivable with the same external ID.
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
select public.commit_receivables_import(
  :'org_a'::uuid, 'empresa-a.csv',
  '[{"customer_name":"Empresa A Cliente","amount":1200.50,"due_date":"2026-09-15","status":"pending","external_id":"FAT-001"}]'::jsonb
);
select id as invoice_a from public.receivables where external_id = 'FAT-001' \gset
select set_config('test.invoice_a', :'invoice_a', false);

select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
select public.commit_receivables_import(
  :'org_b'::uuid, 'empresa-b.csv',
  '[{"customer_name":"Empresa B Cliente","amount":77.00,"due_date":"2026-09-14","status":"pending","external_id":"FAT-001"}]'::jsonb
);
select id as invoice_b from public.receivables where external_id = 'FAT-001' \gset
select set_config('test.invoice_b', :'invoice_b', false);

-- The row-level policy must hide records from other organizations.
do $$
begin
  if (select count(*) from public.receivables) <> 1 then
    raise exception 'Tenant B has inappropriate receivables access';
  end if;
  if (select count(*) from public.customers) <> 1 then
    raise exception 'Tenant B has inappropriate customers access';
  end if;
end $$;

-- Tenant B cannot register payment on tenant A receivable.
do $$
declare rejected boolean := false;
begin
  begin
    perform public.record_receivable_payment(
      current_setting('test.org_b')::uuid,
      current_setting('test.invoice_a')::uuid
    );
  exception when others then rejected := true;
  end;
  if not rejected then raise exception 'Cross-tenant payment was allowed'; end if;
end $$;

select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
do $$
begin
  if (select count(*) from public.receivables) <> 1 then
    raise exception 'Tenant A has inappropriate receivables access';
  end if;
end $$;

select public.record_receivable_payment(:'org_a'::uuid, :'invoice_a'::uuid) as first_payment;
select public.record_receivable_payment(:'org_a'::uuid, :'invoice_a'::uuid) as repeated_payment;

do $$
begin
  if (select count(*) from public.payments
      where receivable_id = current_setting('test.invoice_a')::uuid) <> 1 then
    raise exception 'Duplicate payment was recorded';
  end if;
  if (select count(*) from public.receivables
      where id = current_setting('test.invoice_a')::uuid
        and status = 'paid' and paid_at is not null) <> 1 then
    raise exception 'Receivable status was not updated';
  end if;
end $$;

-- Imports must not overwrite a confirmed payment.
do $$
declare rejected boolean := false;
begin
  begin
    perform public.commit_receivables_import(
      current_setting('test.org_a')::uuid, 'tampered.csv',
      '[{"customer_name":"Empresa A Cliente","amount":1.00,"due_date":"2026-09-15","status":"pending","external_id":"FAT-001"}]'::jsonb
    );
  exception when others then rejected := true;
  end;
  if not rejected then raise exception 'Paid receivable overwritten by import'; end if;
end $$;

do $$
begin
  if (select amount from public.receivables
      where id = current_setting('test.invoice_a')::uuid) <> 1200.50 then
    raise exception 'Import changed confirmed payment amount';
  end if;
end $$;

-- Direct ledger writes by authenticated clients are disallowed.
do $$
declare rejected boolean := false;
begin
  begin
    update public.receivables set amount = 1
    where id = current_setting('test.invoice_a')::uuid;
  exception when insufficient_privilege then rejected := true;
  end;
  if not rejected then raise exception 'Direct financial update was allowed'; end if;
end $$;

-- Viewer may read own org but cannot record a payment.
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',false);
do $$
declare rejected boolean := false;
begin
  if (select count(*) from public.receivables) <> 1 then
    raise exception 'Viewer cannot read own org or sees other tenants';
  end if;
  begin
    perform public.record_receivable_payment(
      current_setting('test.org_a')::uuid,
      current_setting('test.invoice_a')::uuid
    );
  exception when others then rejected := true;
  end;
  if not rejected then raise exception 'Viewer was allowed to pay'; end if;
end $$;

-- Check the audit trail as privileged CI-only database role.
reset role;
do $$
begin
  if (select count(*) from public.audit_logs
       where action = 'payment.recorded'
         and entity_id = current_setting('test.invoice_a')::uuid) <> 1 then
    raise exception 'Payment audit trail is missing or duplicated';
  end if;
  if (select count(*) from public.payments
       where receivable_id = current_setting('test.invoice_a')::uuid) <> 1 then
    raise exception 'Payment ledger no longer contains exactly one record';
  end if;
end $$;

rollback;
\echo 'PASS: migrations, auth roles, tenant isolation, idempotence, import protection, audit trail.'
