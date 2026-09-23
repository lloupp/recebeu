begin;

create extension if not exists pgcrypto;
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create type public.organization_role as enum ('owner', 'admin', 'operator', 'viewer');
create type public.receivable_status as enum ('pending', 'paid', 'cancelled');
create type public.import_status as enum ('uploaded', 'mapped', 'validated', 'committed', 'failed');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 160),
  document text,
  timezone text not null default 'America/Sao_Paulo',
  currency text not null default 'BRL',
  created_at timestamptz not null default now()
);

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.organization_role not null default 'operator',
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);
create index organization_members_user_idx on public.organization_members(user_id);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  external_id text,
  name text not null check (char_length(name) between 1 and 200),
  document text,
  email text,
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index customers_org_external_uidx
  on public.customers(organization_id, external_id)
  where external_id is not null;
create index customers_org_name_idx on public.customers(organization_id, name);
create index customers_org_document_idx on public.customers(organization_id, document) where document is not null;
create index customers_org_email_idx on public.customers(organization_id, lower(email)) where email is not null;

create table public.receivables (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete restrict,
  external_id text,
  description text,
  amount numeric(14,2) not null check (amount > 0),
  due_date date not null,
  status public.receivable_status not null default 'pending',
  paid_at timestamptz,
  source text not null default 'manual',
  source_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint receivable_paid_consistency check (status = 'paid' or paid_at is null)
);
create unique index receivables_org_external_uidx
  on public.receivables(organization_id, external_id)
  where external_id is not null;
create index receivables_org_due_idx on public.receivables(organization_id, due_date);
create index receivables_org_status_idx on public.receivables(organization_id, status);
create index receivables_customer_idx on public.receivables(customer_id);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  receivable_id uuid not null references public.receivables(id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0),
  paid_at timestamptz not null,
  source text not null default 'manual',
  reference text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index payments_org_paid_idx on public.payments(organization_id, paid_at desc);
create index payments_receivable_idx on public.payments(receivable_id);

create table public.import_batches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  filename text not null,
  status public.import_status not null default 'uploaded',
  rows_total integer not null default 0 check (rows_total >= 0),
  rows_valid integer not null default 0 check (rows_valid >= 0),
  rows_invalid integer not null default 0 check (rows_invalid >= 0),
  rows_imported integer not null default 0 check (rows_imported >= 0),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.import_column_mappings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  import_batch_id uuid not null references public.import_batches(id) on delete cascade,
  source_column text not null,
  target_field text not null,
  confidence numeric(5,4),
  created_at timestamptz not null default now(),
  unique (import_batch_id, source_column)
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_org_created_idx on public.audit_logs(organization_id, created_at desc);

create or replace function private.is_org_member(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = p_organization_id
      and m.user_id = (select auth.uid())
  );
$$;

create or replace function private.has_org_role(p_organization_id uuid, p_roles public.organization_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = p_organization_id
      and m.user_id = (select auth.uid())
      and m.role = any(p_roles)
  );
$$;

revoke all on function private.is_org_member(uuid) from public;
revoke all on function private.has_org_role(uuid, public.organization_role[]) from public;
grant execute on function private.is_org_member(uuid) to authenticated;
grant execute on function private.has_org_role(uuid, public.organization_role[]) to authenticated;

create or replace function public.create_organization(p_name text, p_document text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_org_id uuid;
begin
  if v_user_id is null then
    raise exception 'authentication required';
  end if;

  if char_length(trim(p_name)) < 2 then
    raise exception 'organization name too short';
  end if;

  insert into public.organizations(name, document)
  values (trim(p_name), nullif(trim(coalesce(p_document, '')), ''))
  returning id into v_org_id;

  insert into public.organization_members(organization_id, user_id, role)
  values (v_org_id, v_user_id, 'owner');

  insert into public.audit_logs(organization_id, actor_user_id, action, entity_type, entity_id)
  values (v_org_id, v_user_id, 'organization.created', 'organization', v_org_id);

  return v_org_id;
end;
$$;
revoke all on function public.create_organization(text, text) from public;
grant execute on function public.create_organization(text, text) to authenticated;

create or replace function public.commit_receivables_import(
  p_organization_id uuid,
  p_filename text,
  p_rows jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_batch_id uuid;
  v_row jsonb;
  v_customer_id uuid;
  v_receivable_id uuid;
  v_total int := 0;
  v_imported int := 0;
  v_name text;
  v_document text;
  v_email text;
  v_phone text;
  v_customer_external text;
  v_receivable_external text;
  v_description text;
  v_amount numeric(14,2);
  v_due_date date;
  v_status public.receivable_status;
  v_paid_at timestamptz;
begin
  if v_user_id is null then raise exception 'authentication required'; end if;
  if not private.has_org_role(p_organization_id, array['owner','admin','operator']::public.organization_role[]) then
    raise exception 'forbidden';
  end if;
  if jsonb_typeof(p_rows) <> 'array' then raise exception 'rows must be an array'; end if;
  if jsonb_array_length(p_rows) = 0 or jsonb_array_length(p_rows) > 5000 then
    raise exception 'rows out of allowed range';
  end if;

  insert into public.import_batches(organization_id, filename, status, rows_total, rows_valid, rows_invalid, created_by)
  values (p_organization_id, left(coalesce(p_filename, 'import'), 255), 'validated', jsonb_array_length(p_rows), jsonb_array_length(p_rows), 0, v_user_id)
  returning id into v_batch_id;

  for v_row in select value from jsonb_array_elements(p_rows) loop
    v_total := v_total + 1;
    v_name := nullif(trim(v_row->>'customer_name'), '');
    v_document := nullif(trim(v_row->>'customer_document'), '');
    v_email := nullif(lower(trim(v_row->>'customer_email')), '');
    v_phone := nullif(trim(v_row->>'customer_phone'), '');
    v_customer_external := nullif(trim(v_row->>'customer_external_id'), '');
    v_receivable_external := nullif(trim(v_row->>'external_id'), '');
    v_description := nullif(trim(v_row->>'description'), '');
    v_amount := (v_row->>'amount')::numeric;
    v_due_date := (v_row->>'due_date')::date;
    v_status := coalesce(nullif(v_row->>'status','')::public.receivable_status, 'pending');
    v_paid_at := case when v_status = 'paid' then nullif(v_row->>'paid_at','')::timestamptz else null end;

    if v_name is null or v_amount <= 0 or v_due_date is null then
      raise exception 'invalid row %', v_total;
    end if;

    v_customer_id := null;

    if v_customer_external is not null then
      select id into v_customer_id from public.customers
      where organization_id = p_organization_id and external_id = v_customer_external limit 1;
    end if;
    if v_customer_id is null and v_document is not null then
      select id into v_customer_id from public.customers
      where organization_id = p_organization_id and document = v_document limit 1;
    end if;
    if v_customer_id is null and v_email is not null then
      select id into v_customer_id from public.customers
      where organization_id = p_organization_id and lower(email) = v_email limit 1;
    end if;
    if v_customer_id is null then
      select id into v_customer_id from public.customers
      where organization_id = p_organization_id and lower(name) = lower(v_name) limit 1;
    end if;

    if v_customer_id is null then
      insert into public.customers(organization_id, external_id, name, document, email, phone)
      values (p_organization_id, v_customer_external, v_name, v_document, v_email, v_phone)
      returning id into v_customer_id;
    else
      update public.customers
      set document = coalesce(document, v_document),
          email = coalesce(email, v_email),
          phone = coalesce(phone, v_phone),
          updated_at = now()
      where id = v_customer_id;
    end if;

    if v_receivable_external is not null then
      select id into v_receivable_id from public.receivables
      where organization_id = p_organization_id and external_id = v_receivable_external limit 1;
    else
      v_receivable_id := null;
    end if;

    if v_receivable_id is null then
      insert into public.receivables(
        organization_id, customer_id, external_id, description, amount, due_date,
        status, paid_at, source, source_reference
      ) values (
        p_organization_id, v_customer_id, v_receivable_external, v_description,
        v_amount, v_due_date, v_status, v_paid_at, 'import', v_batch_id::text
      ) returning id into v_receivable_id;
      v_imported := v_imported + 1;
    else
      update public.receivables
      set customer_id = v_customer_id,
          description = v_description,
          amount = v_amount,
          due_date = v_due_date,
          status = v_status,
          paid_at = v_paid_at,
          source = 'import',
          source_reference = v_batch_id::text,
          updated_at = now()
      where id = v_receivable_id;
      v_imported := v_imported + 1;
    end if;
  end loop;

  update public.import_batches
  set status = 'committed', rows_imported = v_imported
  where id = v_batch_id;

  insert into public.audit_logs(organization_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (
    p_organization_id, v_user_id, 'import.committed', 'import_batch', v_batch_id,
    jsonb_build_object('rows', v_imported, 'filename', left(coalesce(p_filename, 'import'), 255))
  );

  return jsonb_build_object('batch_id', v_batch_id, 'rows_imported', v_imported);
end;
$$;
revoke all on function public.commit_receivables_import(uuid, text, jsonb) from public;
grant execute on function public.commit_receivables_import(uuid, text, jsonb) to authenticated;

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.customers enable row level security;
alter table public.receivables enable row level security;
alter table public.payments enable row level security;
alter table public.import_batches enable row level security;
alter table public.import_column_mappings enable row level security;
alter table public.audit_logs enable row level security;

create policy organizations_select on public.organizations
for select to authenticated using (private.is_org_member(id));
create policy organizations_update on public.organizations
for update to authenticated
using (private.has_org_role(id, array['owner','admin']::public.organization_role[]))
with check (private.has_org_role(id, array['owner','admin']::public.organization_role[]));

create policy members_select on public.organization_members
for select to authenticated using (private.is_org_member(organization_id));
create policy members_insert on public.organization_members
for insert to authenticated
with check (private.has_org_role(organization_id, array['owner','admin']::public.organization_role[]));
create policy members_update on public.organization_members
for update to authenticated
using (private.has_org_role(organization_id, array['owner','admin']::public.organization_role[]))
with check (private.has_org_role(organization_id, array['owner','admin']::public.organization_role[]));
create policy members_delete on public.organization_members
for delete to authenticated
using (private.has_org_role(organization_id, array['owner','admin']::public.organization_role[]));

create policy customers_select on public.customers
for select to authenticated using (private.is_org_member(organization_id));
create policy customers_insert on public.customers
for insert to authenticated
with check (private.has_org_role(organization_id, array['owner','admin','operator']::public.organization_role[]));
create policy customers_update on public.customers
for update to authenticated
using (private.has_org_role(organization_id, array['owner','admin','operator']::public.organization_role[]))
with check (private.has_org_role(organization_id, array['owner','admin','operator']::public.organization_role[]));
create policy customers_delete on public.customers
for delete to authenticated
using (private.has_org_role(organization_id, array['owner','admin']::public.organization_role[]));

create policy receivables_select on public.receivables
for select to authenticated using (private.is_org_member(organization_id));
create policy receivables_insert on public.receivables
for insert to authenticated
with check (
  private.has_org_role(organization_id, array['owner','admin','operator']::public.organization_role[])
  and exists (
    select 1 from public.customers c
    where c.id = customer_id and c.organization_id = organization_id
  )
);
create policy receivables_update on public.receivables
for update to authenticated
using (private.has_org_role(organization_id, array['owner','admin','operator']::public.organization_role[]))
with check (
  private.has_org_role(organization_id, array['owner','admin','operator']::public.organization_role[])
  and exists (
    select 1 from public.customers c
    where c.id = customer_id and c.organization_id = organization_id
  )
);
create policy receivables_delete on public.receivables
for delete to authenticated
using (private.has_org_role(organization_id, array['owner','admin']::public.organization_role[]));

create policy payments_select on public.payments
for select to authenticated using (private.is_org_member(organization_id));
create policy payments_insert on public.payments
for insert to authenticated
with check (
  private.has_org_role(organization_id, array['owner','admin','operator']::public.organization_role[])
  and exists (
    select 1 from public.receivables r
    where r.id = receivable_id and r.organization_id = organization_id
  )
);

create policy imports_select on public.import_batches
for select to authenticated using (private.is_org_member(organization_id));
create policy imports_insert on public.import_batches
for insert to authenticated
with check (
  private.has_org_role(organization_id, array['owner','admin','operator']::public.organization_role[])
  and created_by = (select auth.uid())
);
create policy imports_update on public.import_batches
for update to authenticated
using (private.has_org_role(organization_id, array['owner','admin','operator']::public.organization_role[]))
with check (private.has_org_role(organization_id, array['owner','admin','operator']::public.organization_role[]));

create policy mappings_select on public.import_column_mappings
for select to authenticated using (private.is_org_member(organization_id));
create policy mappings_write on public.import_column_mappings
for all to authenticated
using (private.has_org_role(organization_id, array['owner','admin','operator']::public.organization_role[]))
with check (
  private.has_org_role(organization_id, array['owner','admin','operator']::public.organization_role[])
  and exists (
    select 1 from public.import_batches b
    where b.id = import_batch_id and b.organization_id = organization_id
  )
);

create policy audit_select on public.audit_logs
for select to authenticated
using (private.has_org_role(organization_id, array['owner','admin']::public.organization_role[]));

commit;
