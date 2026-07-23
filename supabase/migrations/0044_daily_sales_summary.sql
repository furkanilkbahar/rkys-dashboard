-- Faz 5 Adım 0: daily_sales_summary — dönem/şube-kıyası raporlarının (Adım 1+)
-- üzerine kurulacağı özet tablo (ARCHITECTURE.md "Analitik & Sistem"). Yalnızca
-- KAPATILMIŞ günler buraya girer (RULES #36 immutability ile tutarlı): satır,
-- close_business_day (0035) ile AYNI transaction içinde, day_closures'la
-- birlikte yazılır — ayrı bir gecelik tarama job'una gerek yok.

create table public.daily_sales_summary (
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
  order_count integer not null,
  created_at timestamptz not null default now(),
  primary key (tenant_id, branch_id, business_date)
);
create index idx_daily_sales_summary_tenant_id on public.daily_sales_summary(tenant_id);
alter table public.daily_sales_summary enable row level security;
create policy "daily_sales_summary_select" on public.daily_sales_summary for select
  using (tenant_id = public.current_tenant_id() and public.is_staff());
grant select on public.daily_sales_summary to authenticated;
grant select, insert, update, delete on public.daily_sales_summary to service_role;

-- close_business_day: 0035'teki gövdeye order_count hesaplaması + aynı
-- transaction'da daily_sales_summary upsert'i eklenir. Diğer davranış (izin
-- kontrolü, "already closed" reddi, day_closures snapshot'ı) değişmez.
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
  v_order_count integer;
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

  select count(*) into v_order_count
  from public.orders
  where branch_id = p_branch_id and tenant_id = v_tenant_id and status <> 'cancelled'
    and (created_at at time zone coalesce(v_timezone, 'UTC'))::date = v_business_date;

  insert into public.day_closures
    (tenant_id, branch_id, business_date, revenue_minor, cash_minor, card_manual_minor, online_minor,
     tips_minor, comps_minor, refunds_minor, cancelled_orders_count, closed_by)
  values
    (v_tenant_id, p_branch_id, v_business_date, v_revenue, v_cash, v_card, v_online,
     v_tips, v_comps, v_refunds, v_cancelled_count, auth.uid())
  returning id into v_closure_id;

  insert into public.daily_sales_summary
    (tenant_id, branch_id, business_date, revenue_minor, cash_minor, card_manual_minor, online_minor,
     tips_minor, comps_minor, refunds_minor, order_count)
  values
    (v_tenant_id, p_branch_id, v_business_date, v_revenue, v_cash, v_card, v_online,
     v_tips, v_comps, v_refunds, v_order_count)
  on conflict (tenant_id, branch_id, business_date) do nothing;

  return v_closure_id;
end;
$$;
revoke all on function public.close_business_day(uuid) from public;
grant execute on function public.close_business_day(uuid) to authenticated;

-- Backfill: mevcut day_closures satırlarından tek seferlik geçmiş doldurma.
-- order_count, day_closures'ta tutulmadığı için tenant saat dilimine göre
-- orders'tan yeniden hesaplanır (aynı filtre: status <> 'cancelled').
insert into public.daily_sales_summary
  (tenant_id, branch_id, business_date, revenue_minor, cash_minor, card_manual_minor, online_minor,
   tips_minor, comps_minor, refunds_minor, order_count)
select
  dc.tenant_id, dc.branch_id, dc.business_date, dc.revenue_minor, dc.cash_minor, dc.card_manual_minor,
  dc.online_minor, dc.tips_minor, dc.comps_minor, dc.refunds_minor,
  coalesce((
    select count(*) from public.orders o
    join public.tenants t on t.id = o.tenant_id
    where o.branch_id = dc.branch_id and o.tenant_id = dc.tenant_id and o.status <> 'cancelled'
      and (o.created_at at time zone coalesce(t.timezone, 'UTC'))::date = dc.business_date
  ), 0)
from public.day_closures dc
on conflict (tenant_id, branch_id, business_date) do nothing;
