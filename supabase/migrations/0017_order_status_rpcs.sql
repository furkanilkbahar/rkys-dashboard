-- Sipariş durum geçişleri (RULES #24) yalnızca bu RPC'ler üzerinden olur —
-- orders tablosunda authenticated'a hiç UPDATE GRANT'i yok (0015), tek kapı
-- burasıdır. D22 karma iptal: pending/approved serbest (cancel_order),
-- preparing sonrası yalnızca istek+garson onayı.

create or replace function public.cancel_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  if public.current_role() <> 'guest' or public.current_table_session_id() is null then
    raise exception 'guest table session required';
  end if;

  select o.status into v_status from public.orders o
  where o.id = p_order_id and o.table_session_id = public.current_table_session_id()
  for update;

  if not found then
    raise exception 'order not found';
  end if;
  if v_status not in ('pending', 'approved') then
    raise exception 'ORDER_NOT_CANCELLABLE';
  end if;

  update public.orders set status = 'cancelled', updated_at = now() where id = p_order_id;
end;
$$;
revoke all on function public.cancel_order(uuid) from public;
grant execute on function public.cancel_order(uuid) to authenticated;

create or replace function public.request_order_cancellation(p_order_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  if public.current_role() <> 'guest' or public.current_table_session_id() is null then
    raise exception 'guest table session required';
  end if;

  select o.status into v_status from public.orders o
  where o.id = p_order_id and o.table_session_id = public.current_table_session_id()
  for update;

  if not found then
    raise exception 'order not found';
  end if;
  if v_status <> 'preparing' then
    raise exception 'ORDER_NOT_IN_PREPARATION';
  end if;

  update public.orders
  set cancel_requested_at = now(), cancel_requested_reason = p_reason, updated_at = now()
  where id = p_order_id;
end;
$$;
revoke all on function public.request_order_cancellation(uuid, text) from public;
grant execute on function public.request_order_cancellation(uuid, text) to authenticated;

create or replace function public.approve_cancellation_request(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_requested timestamptz;
begin
  if not public.is_staff() then
    raise exception 'staff only';
  end if;

  select o.status, o.cancel_requested_at into v_status, v_requested from public.orders o
  where o.id = p_order_id and o.tenant_id = public.current_tenant_id()
  for update;

  if not found or v_requested is null or v_status <> 'preparing' then
    raise exception 'no pending cancellation request';
  end if;

  update public.orders set status = 'cancelled', updated_at = now() where id = p_order_id;
end;
$$;
revoke all on function public.approve_cancellation_request(uuid) from public;
grant execute on function public.approve_cancellation_request(uuid) to authenticated;

create or replace function public.reject_cancellation_request(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_requested timestamptz;
begin
  if not public.is_staff() then
    raise exception 'staff only';
  end if;

  select o.cancel_requested_at into v_requested from public.orders o
  where o.id = p_order_id and o.tenant_id = public.current_tenant_id()
  for update;

  if not found or v_requested is null then
    raise exception 'no pending cancellation request';
  end if;

  update public.orders
  set cancel_requested_at = null, cancel_requested_reason = null, updated_at = now()
  where id = p_order_id;
end;
$$;
revoke all on function public.reject_cancellation_request(uuid) from public;
grant execute on function public.reject_cancellation_request(uuid) to authenticated;

create or replace function public.approve_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  if not public.is_staff() then
    raise exception 'staff only';
  end if;

  select o.status into v_status from public.orders o
  where o.id = p_order_id and o.tenant_id = public.current_tenant_id()
  for update;

  if not found or v_status <> 'pending' then
    raise exception 'order is not pending approval';
  end if;

  update public.orders set status = 'approved', updated_at = now() where id = p_order_id;
end;
$$;
revoke all on function public.approve_order(uuid) from public;
grant execute on function public.approve_order(uuid) to authenticated;

-- RULES #24'ün gerçek kapısı: sabit kodlu legal-next-status haritası,
-- pending->served gibi atlamalar burada yapısal olarak reddedilir.
create or replace function public.advance_order_status(p_order_id uuid, p_to_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_legal_next text;
begin
  if not public.is_staff() then
    raise exception 'staff only';
  end if;

  select o.status into v_status from public.orders o
  where o.id = p_order_id and o.tenant_id = public.current_tenant_id()
  for update;
  if not found then
    raise exception 'order not found';
  end if;

  v_legal_next := case v_status
    when 'approved' then 'preparing'
    when 'preparing' then 'ready'
    when 'ready' then 'served'
    else null
  end;

  if v_legal_next is null or p_to_status <> v_legal_next then
    raise exception 'ILLEGAL_TRANSITION:% -> %', v_status, p_to_status;
  end if;

  update public.orders set status = p_to_status, updated_at = now() where id = p_order_id;
end;
$$;
revoke all on function public.advance_order_status(uuid, text) from public;
grant execute on function public.advance_order_status(uuid, text) to authenticated;
