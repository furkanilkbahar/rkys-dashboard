-- Faz 7 Adım 1: sadakat motoru — damga/puan + kazanım/harcama (S31).
-- Ledger deseni cash_movements/comps ile aynı: immutable loyalty_transactions
-- + materyalize edilmiş loyalty_balances sayacı (coupons.used_count'un aynı
-- transaction içinde artırılması emsaliyle, 0051).

create table public.loyalty_programs (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  mode text not null check (mode in ('stamp', 'points')),
  config jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.loyalty_programs enable row level security;
create policy "loyalty_programs_select" on public.loyalty_programs for select
  using (tenant_id = public.current_tenant_id() and public.is_staff());
create policy "loyalty_programs_staff_write" on public.loyalty_programs for all
  using (tenant_id = public.current_tenant_id() and public.is_staff())
  with check (tenant_id = public.current_tenant_id() and public.is_staff());
grant select, insert, update, delete on public.loyalty_programs to authenticated;
grant all on public.loyalty_programs to service_role;

create table public.loyalty_balances (
  customer_id uuid primary key references public.customers(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);
create index idx_loyalty_balances_tenant_id on public.loyalty_balances(tenant_id);
alter table public.loyalty_balances enable row level security;
create policy "loyalty_balances_select" on public.loyalty_balances for select
  using (tenant_id = public.current_tenant_id() and public.is_staff());
-- Misafir kendi bakiyesini görebilir (sadakatin amacı bu) — RULES #38'in
-- telefon maskeleme gereği bakiyeyi değil telefon numarasını kapsıyor.
create policy "loyalty_balances_select_own_session" on public.loyalty_balances for select
  using (
    public.current_role() = 'guest'
    and customer_id = (select customer_id from public.table_sessions where id = public.current_table_session_id())
  );
grant select on public.loyalty_balances to authenticated;
grant all on public.loyalty_balances to service_role;

create table public.loyalty_transactions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  customer_id uuid not null references public.customers(id) on delete cascade,
  delta integer not null check (delta <> 0),
  type text not null check (type in ('earn', 'redeem', 'adjustment')),
  order_id uuid references public.orders(id) on delete set null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index idx_loyalty_transactions_tenant_id on public.loyalty_transactions(tenant_id);
create index idx_loyalty_transactions_customer_id on public.loyalty_transactions(customer_id);
alter table public.loyalty_transactions enable row level security;
create policy "loyalty_transactions_select" on public.loyalty_transactions for select
  using (tenant_id = public.current_tenant_id() and public.is_staff());
grant select on public.loyalty_transactions to authenticated;
grant all on public.loyalty_transactions to service_role;

-- comps ile aynı ledger'a yazılır (campaigns'in Faz 6'da aldığı yolun
-- aynısı) — paralel bir indirim tablosu icat edilmez, RULES #18/#35.
alter table public.reason_codes drop constraint reason_codes_category_check;
alter table public.reason_codes add constraint reason_codes_category_check
  check (category in ('comp', 'refund', 'cancel', 'campaign', 'loyalty'));

create or replace function public.create_default_loyalty_reason_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.reason_codes (tenant_id, category, key, display_order)
  values (new.id, 'loyalty', 'loyalty_redemption', 0);
  return new;
end;
$$;

create trigger trg_tenants_create_loyalty_reason_code
after insert on public.tenants
for each row execute function public.create_default_loyalty_reason_code();

insert into public.reason_codes (tenant_id, category, key, display_order)
select id, 'loyalty', 'loyalty_redemption', 0 from public.tenants
on conflict (tenant_id, category, key) do nothing;

-- record_payment (0049) imzası değişmiyor — kazanım tamamen otomatik,
-- yeni bir parametre gerekmiyor, bu yüzden drop gerekmez.
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
  v_customer_id uuid;
  v_loyalty_mode text;
  v_loyalty_config jsonb;
  v_earn_amount integer;
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

    -- Kazanım: oturum bir müşteriye bağlıysa (S30) ve tenant'ın aktif bir
    -- sadakat programı varsa, oturum TAM kapanınca bir kez hesaplanır
    -- (bölünmüş/kısmi ödemelerde çifte sayım olmasın diye).
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
revoke all on function public.record_payment(uuid, text, integer, integer, uuid, jsonb) from public;
grant execute on function public.record_payment(uuid, text, integer, integer, uuid, jsonb) to authenticated;

-- redeem_loyalty_to_order: apply_coupon_to_order (0051) ile birebir aynı
-- yetki deseni (misafir yalnızca kendi oturumunun siparişini hedefleyebilir,
-- staff herhangi birini). Miktar parametre olarak alınmaz — indirim tamamen
-- sunucu tarafında hesaplanır: stamp modunda eşiğe ulaşınca sabit ödül
-- tutarı, points modunda mevcut bakiyenin tamamı (sipariş tutarını aşarsa
-- kapanır, tıpkı record_comp/apply_coupon_to_order'ın subtotal-cap deseni).
create or replace function public.redeem_loyalty_to_order(p_order_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid := public.current_tenant_id();
  v_branch_id uuid;
  v_table_session_id uuid;
  v_subtotal integer;
  v_status text;
  v_customer_id uuid;
  v_balance integer := 0;
  v_loyalty_mode text;
  v_loyalty_config jsonb;
  v_threshold integer;
  v_reward_value_minor integer;
  v_redeem_rate_minor_per_point integer;
  v_discount integer;
  v_points_used integer;
  v_already_comped integer;
  v_reason_code_id uuid;
  v_comp_id uuid;
  v_created_by uuid;
begin
  select branch_id, table_session_id, subtotal_minor, status
  into v_branch_id, v_table_session_id, v_subtotal, v_status
  from public.orders
  where id = p_order_id and tenant_id = v_tenant_id
  for update;
  if not found or v_status = 'cancelled' then
    raise exception 'order not eligible';
  end if;

  if public.current_role() = 'guest' and v_table_session_id is distinct from public.current_table_session_id() then
    raise exception 'forbidden';
  end if;

  if not exists (
    select 1 from public.tenant_modules
    where tenant_id = v_tenant_id and module_key = 'crm_loyalty' and is_enabled = true
  ) then
    raise exception 'crm_loyalty module not enabled';
  end if;

  select customer_id into v_customer_id from public.table_sessions where id = v_table_session_id;
  if v_customer_id is null then
    raise exception 'no loyalty customer linked to this session';
  end if;

  select mode, config into v_loyalty_mode, v_loyalty_config
  from public.loyalty_programs
  where tenant_id = v_tenant_id and is_active = true;
  if v_loyalty_mode is null then
    raise exception 'loyalty program not active';
  end if;

  -- select ... into, eşleşen satır yoksa hedefi NULL'a çevirir (declare'daki
  -- := 0 varsayılanını ezer) — coalesce ancak bir satır DÖNDÜĞÜNDE işe yarar,
  -- bu yüzden satır sonrası ayrıca sıfırlanır.
  select balance into v_balance from public.loyalty_balances where customer_id = v_customer_id for update;
  v_balance := coalesce(v_balance, 0);

  if v_loyalty_mode = 'stamp' then
    v_threshold := coalesce((v_loyalty_config->>'threshold')::integer, 0);
    v_reward_value_minor := coalesce((v_loyalty_config->>'rewardValueMinor')::integer, 0);
    if v_threshold <= 0 or v_balance < v_threshold then
      raise exception 'insufficient loyalty balance';
    end if;
    v_points_used := v_threshold;
    v_discount := v_reward_value_minor;
  else
    v_redeem_rate_minor_per_point := coalesce((v_loyalty_config->>'redeemRateMinorPerPoint')::integer, 0);
    if v_balance <= 0 or v_redeem_rate_minor_per_point <= 0 then
      raise exception 'insufficient loyalty balance';
    end if;
    v_points_used := v_balance;
    v_discount := v_balance * v_redeem_rate_minor_per_point;
  end if;

  select coalesce(sum(amount_minor), 0) into v_already_comped from public.comps where order_id = p_order_id;
  if v_discount > v_subtotal - v_already_comped then
    v_discount := greatest(v_subtotal - v_already_comped, 0);
    if v_loyalty_mode = 'points' and v_redeem_rate_minor_per_point > 0 then
      v_points_used := ceil(v_discount::numeric / v_redeem_rate_minor_per_point)::integer;
      v_discount := v_points_used * v_redeem_rate_minor_per_point;
    end if;
  end if;

  if v_discount <= 0 then
    raise exception 'order already fully comped';
  end if;

  select id into v_reason_code_id from public.reason_codes
  where tenant_id = v_tenant_id and category = 'loyalty' and key = 'loyalty_redemption';

  v_created_by := case when public.is_staff() then auth.uid() else null end;

  insert into public.comps (tenant_id, branch_id, order_id, amount_minor, reason_code_id, note, created_by)
  values (v_tenant_id, v_branch_id, p_order_id, v_discount, v_reason_code_id, 'loyalty_redemption', v_created_by)
  returning id into v_comp_id;

  insert into public.loyalty_transactions (tenant_id, branch_id, customer_id, delta, type, order_id, created_by)
  values (v_tenant_id, v_branch_id, v_customer_id, -v_points_used, 'redeem', p_order_id, v_created_by);

  update public.loyalty_balances set balance = balance - v_points_used, updated_at = now() where customer_id = v_customer_id;

  return v_discount;
end;
$$;
revoke all on function public.redeem_loyalty_to_order(uuid) from public;
grant execute on function public.redeem_loyalty_to_order(uuid) to authenticated;
