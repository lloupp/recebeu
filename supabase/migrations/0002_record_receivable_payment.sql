begin;

-- Payment registration is atomic: the receivable, payment ledger, and audit log
-- are written in a single transaction. Amount and status always come from DB.
create or replace function public.record_receivable_payment(
  p_organization_id uuid,
  p_receivable_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_amount numeric(14,2);
  v_status public.receivable_status;
  v_payment_id uuid;
  v_paid_at timestamptz := now();
begin
  if v_user_id is null then
    raise exception 'authentication required';
  end if;

  if not private.has_org_role(
    p_organization_id,
    array['owner', 'admin', 'operator']::public.organization_role[]
  ) then
    raise exception 'forbidden';
  end if;

  select r.amount, r.status
  into v_amount, v_status
  from public.receivables r
  where r.id = p_receivable_id
    and r.organization_id = p_organization_id
  for update;

  if not found then
    raise exception 'receivable not found';
  end if;
  if v_status = 'paid' then
    return jsonb_build_object('already_paid', true);
  end if;
  if v_status = 'cancelled' then
    raise exception 'cancelled receivable cannot be paid';
  end if;

  update public.receivables
  set status = 'paid', paid_at = v_paid_at, updated_at = v_paid_at
  where id = p_receivable_id and organization_id = p_organization_id;

  insert into public.payments(
    organization_id, receivable_id, amount, paid_at, source, created_by
  ) values (
    p_organization_id, p_receivable_id, v_amount, v_paid_at, 'manual', v_user_id
  ) returning id into v_payment_id;

  insert into public.audit_logs(
    organization_id, actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    p_organization_id, v_user_id, 'payment.recorded', 'receivable',
    p_receivable_id, jsonb_build_object('payment_id', v_payment_id)
  );

  return jsonb_build_object('ok', true, 'payment_id', v_payment_id);
end;
$$;

revoke all on function public.record_receivable_payment(uuid, uuid) from public;
revoke all on function public.record_receivable_payment(uuid, uuid) from anon;
grant execute on function public.record_receivable_payment(uuid, uuid) to authenticated;

-- A confirmed payment must not be silently undone/rewritten by spreadsheet
-- re-imports. Correcting a reconciled payment requires a separate audited flow.
create or replace function private.protect_imported_paid_receivable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'paid' and new.source = 'import'
    and (
      new.status is distinct from old.status
      or new.amount is distinct from old.amount
      or new.paid_at is distinct from old.paid_at
    ) then
    raise exception 'a confirmed payment cannot be changed by spreadsheet import';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_imported_paid_receivable on public.receivables;
create trigger protect_imported_paid_receivable
before update on public.receivables
for each row execute function private.protect_imported_paid_receivable();

-- Do not let authenticated clients bypass the ledger by writing directly
-- to receivables or payments. The existing import RPC and this payment RPC
-- run under reviewed, explicit authorization and remain functional.
revoke insert, update, delete on table public.receivables from public, anon, authenticated;
revoke insert, update, delete on table public.payments from public, anon, authenticated;

commit;
