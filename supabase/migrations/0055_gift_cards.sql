-- Faz 7 Adım 2: hediye kartı modülü (S32, D52 — bakiye=borç muhasebesi).
-- Ledger deseni loyalty_balances/loyalty_transactions (0054) ile aynı:
-- materyalize balance_minor sayacı + immutable gift_card_transactions.
-- RULES #37: bakiye asla negatife düşemez — hem CHECK kısıtı hem redeem
-- öncesi RPC içi kontrolle iki katmanlı korunur.

create table public.gift_cards (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  code text not null,
  balance_minor integer not null default 0 check (balance_minor >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id, code)
);
create index idx_gift_cards_tenant_id on public.gift_cards(tenant_id);
alter table public.gift_cards enable row level security;
create policy "gift_cards_select" on public.gift_cards for select
  using (tenant_id = public.current_tenant_id() and public.is_staff());
grant select on public.gift_cards to authenticated;
grant all on public.gift_cards to service_role;

create table public.gift_card_transactions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  gift_card_id uuid not null references public.gift_cards(id) on delete cascade,
  amount_minor integer not null check (amount_minor <> 0),
  type text not null check (type in ('issue', 'redeem', 'adjustment')),
  payment_id uuid references public.payments(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index idx_gift_card_transactions_tenant_id on public.gift_card_transactions(tenant_id);
create index idx_gift_card_transactions_gift_card_id on public.gift_card_transactions(gift_card_id);
alter table public.gift_card_transactions enable row level security;
create policy "gift_card_transactions_select" on public.gift_card_transactions for select
  using (tenant_id = public.current_tenant_id() and public.is_staff());
grant select on public.gift_card_transactions to authenticated;
grant all on public.gift_card_transactions to service_role;

-- issue_gift_card: yeni bir hediye kartı satışı/yüklemesi — staff-only.
create or replace function public.issue_gift_card(p_code text, p_initial_balance_minor integer)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid := public.current_tenant_id();
  v_branch_id uuid;
  v_gift_card_id uuid;
begin
  if not public.is_staff() then
    raise exception 'staff only';
  end if;
  if not exists (
    select 1 from public.tenant_modules
    where tenant_id = v_tenant_id and module_key = 'gift_cards' and is_enabled = true
  ) then
    raise exception 'gift_cards module not enabled';
  end if;
  if p_initial_balance_minor <= 0 then
    raise exception 'invalid amount';
  end if;

  select id into v_branch_id from public.branches where tenant_id = v_tenant_id and is_default = true;

  insert into public.gift_cards (tenant_id, code, balance_minor, is_active)
  values (v_tenant_id, p_code, p_initial_balance_minor, true)
  returning id into v_gift_card_id;

  insert into public.gift_card_transactions (tenant_id, branch_id, gift_card_id, amount_minor, type, created_by)
  values (v_tenant_id, v_branch_id, v_gift_card_id, p_initial_balance_minor, 'issue', auth.uid());

  return v_gift_card_id;
end;
$$;
revoke all on function public.issue_gift_card(text, integer) from public;
grant execute on function public.issue_gift_card(text, integer) to authenticated;

-- record_payment (0049/0054): 'gift_card' yöntemi eklenir. İmza değişiyor
-- (yeni parametre) — 0049'daki drop+create emsaliyle önce eski imza düşürülür.
drop function if exists public.record_payment(uuid, text, integer, integer, uuid, jsonb);

alter table public.payments drop constraint payments_method_check;
alter table public.payments add constraint payments_method_check
  check (method in ('cash', 'card_manual', 'online', 'gift_card'));

create or replace function public.record_payment(
  p_table_session_id uuid,
  p_method text,
  p_amount_minor integer,
  p_tip_amount_minor integer default 0,
  p_split_group uuid default null,
  p_item_allocations jsonb default null,
  p_gift_card_code text default null
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
  v_customer_id uuid;
  v_loyalty_mode text;
  v_loyalty_config jsonb;
  v_earn_amount integer;
  v_gift_card_id uuid;
  v_gift_card_balance integer;
begin
  if not public.is_staff() then
    raise exception 'staff only';
  end if;
  if p_method not in ('cash', 'card_manual', 'gift_card') then
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

  if p_method = 'gift_card' then
    if p_gift_card_code is null then
      raise exception 'gift card code required';
    end if;
    select id, balance_minor into v_gift_card_id, v_gift_card_balance
    from public.gift_cards
    where tenant_id = v_tenant_id and code = p_gift_card_code and is_active = true
    for update;
    if v_gift_card_id is null then
      raise exception 'invalid gift card code';
    end if;
    if v_gift_card_balance < p_amount_minor then
      raise exception 'insufficient gift card balance';
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

  if p_method = 'gift_card' then
    insert into public.gift_card_transactions (tenant_id, branch_id, gift_card_id, amount_minor, type, payment_id, created_by)
    values (v_tenant_id, v_branch_id, v_gift_card_id, -p_amount_minor, 'redeem', v_payment_id, auth.uid());

    update public.gift_cards set balance_minor = balance_minor - p_amount_minor where id = v_gift_card_id;
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

    select customer_id into v_customer_id from public.table_sessions where id = p_table_session_id;
    if v_customer_id is not null then
      select mode, config into v_loyalty_mode, v_loyalty_config
      from public.loyalty_programs
      where tenant_id = v_tenant_id and is_active = true;

      if v_loyalty_mode is not null then
        v_earn_amount := case v_loyalty_mode
          when 'stamp' then 1
          when 'points' then floor(v_session_subtotal * coalesce((v_loyalty_config->>'earnRatePer100Minor')::numeric, 0) / 100)::integer
          else 0
        end;

        if v_earn_amount > 0 then
          insert into public.loyalty_transactions (tenant_id, branch_id, customer_id, delta, type, order_id, created_by)
          values (v_tenant_id, v_branch_id, v_customer_id, v_earn_amount, 'earn', null, auth.uid());

          insert into public.loyalty_balances (customer_id, tenant_id, balance)
          values (v_customer_id, v_tenant_id, v_earn_amount)
          on conflict (customer_id) do update set balance = loyalty_balances.balance + v_earn_amount, updated_at = now();
        end if;
      end if;
    end if;
  end if;

  return v_payment_id;
end;
$$;
revoke all on function public.record_payment(uuid, text, integer, integer, uuid, jsonb, text) from public;
grant execute on function public.record_payment(uuid, text, integer, integer, uuid, jsonb, text) to authenticated;
