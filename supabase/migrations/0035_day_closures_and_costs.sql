-- Faz 3 Adım 6: gün sonu + manuel maliyet/marj. product_costs tenant'ın
-- ürün başı manuel birim maliyetini tutar (tam stok/reçete sistemi Faz 8);
-- day_closures bir (tenant, branch, business_date) için değişmez bir
-- kapanış anlık görüntüsüdür (RULES #36).

create table public.product_costs (
  product_id uuid primary key references public.products(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  cost_minor integer not null check (cost_minor >= 0),
  updated_at timestamptz not null default now()
);
create index idx_product_costs_tenant_id on public.product_costs(tenant_id);
alter table public.product_costs enable row level security;
create policy "product_costs_select" on public.product_costs for select
  using (tenant_id = public.current_tenant_id() and public.is_staff());
create policy "product_costs_staff_write" on public.product_costs for all
  using (tenant_id = public.current_tenant_id() and public.is_staff())
  with check (tenant_id = public.current_tenant_id() and public.is_staff());
grant select, insert, update, delete on public.product_costs to authenticated, service_role;

create table public.day_closures (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  business_date date not null,
  revenue_minor integer not null,
  cash_minor integer not null,
  card_manual_minor integer not null,
  online_minor integer not null,
  tips_minor integer not null,
  comps_minor integer not null,
  refunds_minor integer not null,
  cancelled_orders_count integer not null,
  closed_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (tenant_id, branch_id, business_date)
);
create index idx_day_closures_tenant_id on public.day_closures(tenant_id);
alter table public.day_closures enable row level security;
create policy "day_closures_select" on public.day_closures for select
  using (tenant_id = public.current_tenant_id() and public.is_staff());
grant select on public.day_closures to authenticated;
grant select, insert, update, delete on public.day_closures to service_role;

-- is_business_date_closed: p_at'in tenant saat dilimindeki takvim gününe
-- karşılık gelen day_closures kaydı var mı? (RULES #36 immutability guard'ının
-- temel taşı).
create or replace function public.is_business_date_closed(p_branch_id uuid, p_at timestamptz default now())
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_timezone text;
  v_business_date date;
begin
  select tenant_id into v_tenant_id from public.branches where id = p_branch_id;
  select timezone into v_timezone from public.tenants where id = v_tenant_id;
  v_business_date := (p_at at time zone coalesce(v_timezone, 'UTC'))::date;

  return exists (
    select 1 from public.day_closures
    where branch_id = p_branch_id and business_date = v_business_date
  );
end;
$$;
revoke all on function public.is_business_date_closed(uuid, timestamptz) from public;
grant execute on function public.is_business_date_closed(uuid, timestamptz) to authenticated, service_role;

-- Immutability guard (RULES #36): kapanmış bir güne yeni payments/
-- cash_movements satırı eklenemez — düzeltme her zaman YENİ (açık) bir
-- güne yeni kayıt olarak yapılır. record_payment/record_comp/record_refund/
-- record_cash_movement gövdeleri değiştirilmez, trigger seviyesinde eklenir.
create or replace function public.check_business_date_not_closed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_business_date_closed(new.branch_id, new.created_at) then
    raise exception 'business day closed';
  end if;
  return new;
end;
$$;

create trigger trg_payments_business_date_guard
before insert on public.payments
for each row execute function public.check_business_date_not_closed();

create trigger trg_cash_movements_business_date_guard
before insert on public.cash_movements
for each row execute function public.check_business_date_not_closed();

-- close_business_day: cash.open_close izniyle, tenant saat dilimindeki
-- bugünün kapanış anlık görüntüsünü oluşturur — bir kez oluşturulunca o
-- tarih için trigger'lar yeni payments/cash_movements'ı reddeder.
create or replace function public.close_business_day(p_branch_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid := public.current_tenant_id();
  v_timezone text;
  v_business_date date;
  v_closure_id uuid;
  v_revenue integer;
  v_cash integer;
  v_card integer;
  v_online integer;
  v_tips integer;
  v_comps integer;
  v_refunds integer;
  v_cancelled_count integer;
begin
  if not public.current_can('cash.open_close') then
    raise exception 'forbidden';
  end if;

  select timezone into v_timezone from public.tenants where id = v_tenant_id;
  v_business_date := (now() at time zone coalesce(v_timezone, 'UTC'))::date;

  if exists (
    select 1 from public.day_closures
    where tenant_id = v_tenant_id and branch_id = p_branch_id and business_date = v_business_date
  ) then
    raise exception 'already closed';
  end if;

  select
    coalesce(sum(amount_minor), 0),
    coalesce(sum(amount_minor) filter (where method = 'cash'), 0),
    coalesce(sum(amount_minor) filter (where method = 'card_manual'), 0),
    coalesce(sum(amount_minor) filter (where method = 'online'), 0),
    coalesce(sum(tip_amount_minor), 0)
  into v_revenue, v_cash, v_card, v_online, v_tips
  from public.payments
  where branch_id = p_branch_id and tenant_id = v_tenant_id and status = 'completed'
    and (created_at at time zone coalesce(v_timezone, 'UTC'))::date = v_business_date;

  select coalesce(sum(amount_minor), 0) into v_comps
  from public.comps
  where branch_id = p_branch_id and tenant_id = v_tenant_id
    and (created_at at time zone coalesce(v_timezone, 'UTC'))::date = v_business_date;

  select coalesce(sum(amount_minor), 0) into v_refunds
  from public.refunds
  where branch_id = p_branch_id and tenant_id = v_tenant_id
    and (created_at at time zone coalesce(v_timezone, 'UTC'))::date = v_business_date;

  select count(*) into v_cancelled_count
  from public.orders
  where branch_id = p_branch_id and tenant_id = v_tenant_id and status = 'cancelled'
    and (updated_at at time zone coalesce(v_timezone, 'UTC'))::date = v_business_date;

  insert into public.day_closures
    (tenant_id, branch_id, business_date, revenue_minor, cash_minor, card_manual_minor, online_minor,
     tips_minor, comps_minor, refunds_minor, cancelled_orders_count, closed_by)
  values
    (v_tenant_id, p_branch_id, v_business_date, v_revenue, v_cash, v_card, v_online,
     v_tips, v_comps, v_refunds, v_cancelled_count, auth.uid())
  returning id into v_closure_id;

  return v_closure_id;
end;
$$;
revoke all on function public.close_business_day(uuid) from public;
grant execute on function public.close_business_day(uuid) to authenticated;

-- Temel rapor seti (Adım 6): tenant saat dilimine göre business_date sınırı
-- SQL'de hesaplanır (JS tarafında IANA saat dilimi aritmetiği tekrarlamamak
-- için) — reports.revenue izni gerektirir.
create or replace function public.get_revenue_report(p_branch_id uuid, p_business_date date)
returns table(
  revenue_minor integer, cash_minor integer, card_manual_minor integer,
  online_minor integer, tips_minor integer, comps_minor integer, refunds_minor integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid := public.current_tenant_id();
  v_timezone text;
begin
  if not public.current_can('reports.revenue') then
    raise exception 'forbidden';
  end if;
  select timezone into v_timezone from public.tenants where id = v_tenant_id;

  return query
  select
    coalesce(sum(p.amount_minor), 0)::integer,
    coalesce(sum(p.amount_minor) filter (where p.method = 'cash'), 0)::integer,
    coalesce(sum(p.amount_minor) filter (where p.method = 'card_manual'), 0)::integer,
    coalesce(sum(p.amount_minor) filter (where p.method = 'online'), 0)::integer,
    coalesce(sum(p.tip_amount_minor), 0)::integer,
    coalesce((select sum(c.amount_minor) from public.comps c
      where c.branch_id = p_branch_id and c.tenant_id = v_tenant_id
      and (c.created_at at time zone coalesce(v_timezone, 'UTC'))::date = p_business_date), 0)::integer,
    coalesce((select sum(r.amount_minor) from public.refunds r
      where r.branch_id = p_branch_id and r.tenant_id = v_tenant_id
      and (r.created_at at time zone coalesce(v_timezone, 'UTC'))::date = p_business_date), 0)::integer
  from public.payments p
  where p.branch_id = p_branch_id and p.tenant_id = v_tenant_id and p.status = 'completed'
    and (p.created_at at time zone coalesce(v_timezone, 'UTC'))::date = p_business_date;
end;
$$;
revoke all on function public.get_revenue_report(uuid, date) from public;
grant execute on function public.get_revenue_report(uuid, date) to authenticated;

create or replace function public.get_top_products(p_branch_id uuid, p_business_date date)
returns table(product_name text, quantity integer, revenue_minor integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid := public.current_tenant_id();
  v_timezone text;
begin
  if not public.current_can('reports.revenue') then
    raise exception 'forbidden';
  end if;
  select timezone into v_timezone from public.tenants where id = v_tenant_id;

  return query
  select oi.product_name_snapshot, sum(oi.quantity)::integer, sum(oi.line_subtotal_minor)::integer
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where oi.branch_id = p_branch_id and oi.tenant_id = v_tenant_id and o.status <> 'cancelled'
    and (oi.created_at at time zone coalesce(v_timezone, 'UTC'))::date = p_business_date
  group by oi.product_name_snapshot
  order by sum(oi.line_subtotal_minor) desc;
end;
$$;
revoke all on function public.get_top_products(uuid, date) from public;
grant execute on function public.get_top_products(uuid, date) to authenticated;

create or replace function public.get_hourly_density(p_branch_id uuid, p_business_date date)
returns table(hour_of_day integer, order_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid := public.current_tenant_id();
  v_timezone text;
begin
  if not public.current_can('reports.revenue') then
    raise exception 'forbidden';
  end if;
  select timezone into v_timezone from public.tenants where id = v_tenant_id;

  return query
  select extract(hour from o.created_at at time zone coalesce(v_timezone, 'UTC'))::integer, count(*)::integer
  from public.orders o
  where o.branch_id = p_branch_id and o.tenant_id = v_tenant_id and o.status <> 'cancelled'
    and (o.created_at at time zone coalesce(v_timezone, 'UTC'))::date = p_business_date
  group by 1
  order by 1;
end;
$$;
revoke all on function public.get_hourly_density(uuid, date) from public;
grant execute on function public.get_hourly_density(uuid, date) to authenticated;

-- Kâr marjı: reports.profit izni gerektirir (reports.revenue'dan ayrı —
-- maliyet verisi daha hassas kabul edilir).
create or replace function public.get_margin_report(p_branch_id uuid, p_business_date date)
returns table(product_name text, quantity integer, revenue_minor integer, cost_minor integer, margin_minor integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid := public.current_tenant_id();
  v_timezone text;
begin
  if not public.current_can('reports.profit') then
    raise exception 'forbidden';
  end if;
  select timezone into v_timezone from public.tenants where id = v_tenant_id;

  return query
  select
    oi.product_name_snapshot,
    sum(oi.quantity)::integer,
    sum(oi.line_subtotal_minor)::integer,
    coalesce(sum(oi.quantity * pc.cost_minor), 0)::integer,
    (sum(oi.line_subtotal_minor) - coalesce(sum(oi.quantity * pc.cost_minor), 0))::integer
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  left join public.product_costs pc on pc.product_id = oi.product_id
  where oi.branch_id = p_branch_id and oi.tenant_id = v_tenant_id and o.status <> 'cancelled'
    and (oi.created_at at time zone coalesce(v_timezone, 'UTC'))::date = p_business_date
  group by oi.product_name_snapshot
  order by sum(oi.line_subtotal_minor) desc;
end;
$$;
revoke all on function public.get_margin_report(uuid, date) from public;
grant execute on function public.get_margin_report(uuid, date) to authenticated;

-- S9 "gün sonu sayım/fark": o iş gününde AÇILMIŞ vardiyaların sayım/fark
-- listesi (kapanmamış vardiya varsa expected/variance/counted null döner).
create or replace function public.get_shifts_for_date(p_branch_id uuid, p_business_date date)
returns table(
  shift_id uuid, opened_at timestamptz, closed_at timestamptz,
  opening_balance_minor integer, counted_cash_minor integer,
  expected_cash_minor integer, variance_minor integer, status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid := public.current_tenant_id();
  v_timezone text;
begin
  if not public.current_can('reports.revenue') then
    raise exception 'forbidden';
  end if;
  select timezone into v_timezone from public.tenants where id = v_tenant_id;

  return query
  select cs.id, cs.opened_at, cs.closed_at, cs.opening_balance_minor,
    cs.counted_cash_minor, cs.expected_cash_minor, cs.variance_minor, cs.status
  from public.cash_shifts cs
  where cs.branch_id = p_branch_id and cs.tenant_id = v_tenant_id
    and (cs.opened_at at time zone coalesce(v_timezone, 'UTC'))::date = p_business_date
  order by cs.opened_at;
end;
$$;
revoke all on function public.get_shifts_for_date(uuid, date) from public;
grant execute on function public.get_shifts_for_date(uuid, date) to authenticated;
