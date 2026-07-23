-- Faz 6 Adım 0: kalem bazlı hesap bölme altyapısı (S25, ortak altyapı — D44).
-- payment_item_allocations bir ödemenin hangi sipariş kalemini (order_items)
-- ne kadar karşıladığını izler. record_payment (0031/0033) geriye dönük
-- uyumlu genişletilir: yeni p_item_allocations parametresi opsiyoneldir ve
-- verilmezse (mevcut tüm çağrılar) davranış hiç değişmez.

create table public.payment_item_allocations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  payment_id uuid not null references public.payments(id) on delete cascade,
  order_item_id uuid not null references public.order_items(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  amount_minor integer not null check (amount_minor > 0),
  created_at timestamptz not null default now()
);
create index idx_payment_item_allocations_tenant_id on public.payment_item_allocations(tenant_id);
create index idx_payment_item_allocations_payment_id on public.payment_item_allocations(payment_id);
create index idx_payment_item_allocations_order_item_id on public.payment_item_allocations(order_item_id);
alter table public.payment_item_allocations enable row level security;
create policy "payment_item_allocations_select" on public.payment_item_allocations for select
  using (tenant_id = public.current_tenant_id() and public.is_staff());
grant select on public.payment_item_allocations to authenticated;
grant select, insert, update, delete on public.payment_item_allocations to service_role;

-- record_payment imzası değişiyor (yeni parametre) — Faz 5 Adım 1'deki
-- approve_cancellation_request ile aynı gerekçeyle önce eski imza düşürülür.
drop function if exists public.record_payment(uuid, text, integer, integer, uuid);

create or replace function public.record_payment(
  p_table_session_id uuid,
  p_method text,
  p_amount_minor integer,
  p_tip_amount_minor integer default 0,
  p_split_group uuid default null,
  p_item_allocations jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid := public.current_tenant_id();
  v_branch_id uuid;
  v_status text;
  v_payment_id uuid;
  v_shift_id uuid;
  v_session_subtotal integer;
  v_session_comped integer;
  v_already_paid integer;
  v_allocation_total integer;
begin
  if not public.is_staff() then
    raise exception 'staff only';
  end if;
  if p_method not in ('cash', 'card_manual') then
    raise exception 'invalid method';
  end if;
  if p_amount_minor <= 0 then
    raise exception 'invalid amount';
  end if;

  select branch_id, status into v_branch_id, v_status
  from public.table_sessions
  where id = p_table_session_id and tenant_id = v_tenant_id
  for update;
  if not found or v_status <> 'active' then
    raise exception 'table session is not active';
  end if;

  if p_item_allocations is not null then
    select coalesce(sum((elem->>'amountMinor')::integer), 0) into v_allocation_total
    from jsonb_array_elements(p_item_allocations) elem;
    if v_allocation_total <> p_amount_minor then
      raise exception 'item allocations do not match amount';
    end if;

    if exists (
      select 1 from jsonb_array_elements(p_item_allocations) elem
      where not exists (
        select 1 from public.order_items oi
        join public.orders o on o.id = oi.order_id
        where oi.id = (elem->>'orderItemId')::uuid
          and o.table_session_id = p_table_session_id
          and oi.tenant_id = v_tenant_id
      )
    ) then
      raise exception 'invalid order item allocation';
    end if;

    -- Aynı kalem birden fazla ödemede seçilebilir (farklı share'ler) ama
    -- toplam ödenen miktar order_items.quantity'yi aşamaz.
    if exists (
      select 1
      from (
        select (elem->>'orderItemId')::uuid as order_item_id, sum((elem->>'quantity')::integer) as requested_quantity
        from jsonb_array_elements(p_item_allocations) elem
        group by (elem->>'orderItemId')::uuid
      ) req
      join public.order_items oi on oi.id = req.order_item_id
      left join public.payment_item_allocations pia
        on pia.order_item_id = req.order_item_id
        and pia.payment_id in (select id from public.payments where status = 'completed')
      group by req.order_item_id, req.requested_quantity, oi.quantity
      having req.requested_quantity + coalesce(sum(pia.quantity), 0) > oi.quantity
    ) then
      raise exception 'item allocation exceeds ordered quantity';
    end if;
  end if;

  insert into public.payments
    (tenant_id, branch_id, table_session_id, method, provider, amount_minor, tip_amount_minor, split_group, status, created_by)
  values
    (v_tenant_id, v_branch_id, p_table_session_id, p_method, 'manual', p_amount_minor, p_tip_amount_minor, p_split_group, 'completed', auth.uid())
  returning id into v_payment_id;

  if p_item_allocations is not null then
    insert into public.payment_item_allocations (tenant_id, branch_id, payment_id, order_item_id, quantity, amount_minor)
    select v_tenant_id, v_branch_id, v_payment_id, (elem->>'orderItemId')::uuid, (elem->>'quantity')::integer, (elem->>'amountMinor')::integer
    from jsonb_array_elements(p_item_allocations) elem;
  end if;

  if p_method = 'cash' then
    select id into v_shift_id from public.cash_shifts
    where branch_id = v_branch_id and status = 'open';
    if v_shift_id is not null then
      insert into public.cash_movements (tenant_id, branch_id, cash_shift_id, movement_type, amount_minor, note, created_by)
      values (v_tenant_id, v_branch_id, v_shift_id, 'sale', p_amount_minor + p_tip_amount_minor, 'payment:' || v_payment_id, auth.uid());
    end if;
  end if;

  select coalesce(sum(o.subtotal_minor), 0) into v_session_subtotal
  from public.orders o
  where o.table_session_id = p_table_session_id and o.status <> 'cancelled';

  select coalesce(sum(c.amount_minor), 0) into v_session_comped
  from public.comps c
  join public.orders o on o.id = c.order_id
  where o.table_session_id = p_table_session_id;

  select coalesce(sum(amount_minor), 0) into v_already_paid
  from public.payments
  where table_session_id = p_table_session_id and status = 'completed';

  if v_already_paid >= v_session_subtotal - v_session_comped then
    update public.table_sessions
    set status = 'closed', closed_at = now(), close_reason = 'payment'
    where id = p_table_session_id;

    insert into public.session_events (tenant_id, branch_id, table_session_id, event_type, actor_profile_id, reason)
    values (v_tenant_id, v_branch_id, p_table_session_id, 'closed', auth.uid(), 'payment');
  end if;

  return v_payment_id;
end;
$$;
revoke all on function public.record_payment(uuid, text, integer, integer, uuid, jsonb) from public;
grant execute on function public.record_payment(uuid, text, integer, integer, uuid, jsonb) to authenticated;
