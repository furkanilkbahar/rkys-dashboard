-- Faz 5 Adım 1: dönem/geçen yıl kıyası + kayıp-kaçak raporu (S21).
-- Dönem/şube-kıyası RPC'leri daily_sales_summary (0044) üzerinden aggregate
-- eder; mevcut tek-tarihli rapor RPC'leri (0035) değiştirilmez.

-- orders.cancel_reason_code_id: comps/refunds zaten reason_code_id taşıyor
-- (0033) ama iptal edilen siparişlerin hiç sebep-kodu bağlantısı yoktu — bu
-- kolon olmadan kayıp-kaçak raporunun iptal satırı hiçbir zaman sebebe göre
-- gruplanamaz. NOT: bu kolonu dolduracak personel onay UI'ı (garson paneli,
-- approve_cancellation_request) henüz hiçbir panelde yok — bu Faz 1'den kalma
-- ayrı bir eksiklik, bu Adım'ın kapsamı dışında bırakıldı (kullanıcı onaylı).
-- Kolon şimdiden eklenir; UI gelene kadar rapor iptalleri "sebepsiz" gösterir.
alter table public.orders add column cancel_reason_code_id uuid references public.reason_codes(id);

-- approve_cancellation_request imzası değişiyor (yeni parametre) — create or
-- replace aynı imzada çalışmadığından eski tek-parametreli fonksiyon önce
-- düşürülür.
drop function if exists public.approve_cancellation_request(uuid);

create or replace function public.approve_cancellation_request(p_order_id uuid, p_reason_code_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid := public.current_tenant_id();
  v_status text;
  v_requested timestamptz;
  v_reason_category text;
begin
  if not public.is_staff() then
    raise exception 'staff only';
  end if;

  if p_reason_code_id is not null then
    select category into v_reason_category from public.reason_codes
    where id = p_reason_code_id and tenant_id = v_tenant_id and is_active = true;
    if v_reason_category is distinct from 'cancel' then
      raise exception 'invalid reason code';
    end if;
  end if;

  select o.status, o.cancel_requested_at into v_status, v_requested from public.orders o
  where o.id = p_order_id and o.tenant_id = v_tenant_id
  for update;

  if not found or v_requested is null or v_status <> 'preparing' then
    raise exception 'no pending cancellation request';
  end if;

  update public.orders set status = 'cancelled', cancel_reason_code_id = p_reason_code_id, updated_at = now() where id = p_order_id;
end;
$$;
revoke all on function public.approve_cancellation_request(uuid, uuid) from public;
grant execute on function public.approve_cancellation_request(uuid, uuid) to authenticated;

-- get_period_revenue_report: daily_sales_summary üzerinden tarih aralığı
-- toplamı. Geçen yıl kıyası app katmanında aynı RPC'ye bir önceki yılın aynı
-- aralığı verilerek yapılır (ayrı bir RPC gerekmez).
create or replace function public.get_period_revenue_report(p_branch_id uuid, p_start_date date, p_end_date date)
returns table(
  revenue_minor integer, cash_minor integer, card_manual_minor integer, online_minor integer,
  tips_minor integer, comps_minor integer, refunds_minor integer, order_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid := public.current_tenant_id();
begin
  if not public.current_can('reports.revenue') then
    raise exception 'forbidden';
  end if;

  return query
  select
    coalesce(sum(dss.revenue_minor), 0)::integer,
    coalesce(sum(dss.cash_minor), 0)::integer,
    coalesce(sum(dss.card_manual_minor), 0)::integer,
    coalesce(sum(dss.online_minor), 0)::integer,
    coalesce(sum(dss.tips_minor), 0)::integer,
    coalesce(sum(dss.comps_minor), 0)::integer,
    coalesce(sum(dss.refunds_minor), 0)::integer,
    coalesce(sum(dss.order_count), 0)::integer
  from public.daily_sales_summary dss
  where dss.tenant_id = v_tenant_id and dss.branch_id = p_branch_id
    and dss.business_date between p_start_date and p_end_date;
end;
$$;
revoke all on function public.get_period_revenue_report(uuid, date, date) from public;
grant execute on function public.get_period_revenue_report(uuid, date, date) to authenticated;

-- get_branch_comparison: Adım 2'nin widget dashboard'unun şube-kıyası
-- kartı bu RPC'yi kullanacak (client'tan tenant_id alınmaz, JWT'den
-- current_tenant_id() ile türetilir — diğer tüm RPC'lerle aynı desen).
create or replace function public.get_branch_comparison(p_start_date date, p_end_date date)
returns table(branch_id uuid, branch_name text, revenue_minor integer, order_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid := public.current_tenant_id();
begin
  if not public.current_can('reports.revenue') then
    raise exception 'forbidden';
  end if;

  return query
  select b.id, b.name, coalesce(sum(dss.revenue_minor), 0)::integer, coalesce(sum(dss.order_count), 0)::integer
  from public.branches b
  left join public.daily_sales_summary dss
    on dss.branch_id = b.id and dss.tenant_id = v_tenant_id
    and dss.business_date between p_start_date and p_end_date
  where b.tenant_id = v_tenant_id
  group by b.id, b.name
  order by b.name;
end;
$$;
revoke all on function public.get_branch_comparison(date, date) from public;
grant execute on function public.get_branch_comparison(date, date) to authenticated;

-- get_loss_report: comp/refund/cancel'ı sebep koduna göre gruplar
-- (reports.loss izni — reports.revenue/profit'ten ayrı, RULES #41 deseni).
-- comp/refund: comps.reason_code_id/refunds.reason_code_id her zaman dolu
-- (0033'te zorunlu), cancel: cancel_reason_code_id (bu migration) henüz
-- hiçbir UI'dan doldurulmuyor — reason_code_id null geldiğinde app katmanı
-- "sebepsiz" olarak gösterir. İptal için amount_minor, siparişin kaybedilen
-- subtotal'ıdır (kayıp-kaçak anlamında gerçek "kayıp" tutarı).
create or replace function public.get_loss_report(p_branch_id uuid, p_start_date date, p_end_date date)
returns table(source text, reason_code_id uuid, reason_key text, amount_minor integer, item_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid := public.current_tenant_id();
  v_timezone text;
begin
  if not public.current_can('reports.loss') then
    raise exception 'forbidden';
  end if;
  select timezone into v_timezone from public.tenants where id = v_tenant_id;

  return query
  select 'comp'::text, c.reason_code_id, rc.key, sum(c.amount_minor)::integer, count(*)::integer
  from public.comps c
  join public.reason_codes rc on rc.id = c.reason_code_id
  where c.tenant_id = v_tenant_id and c.branch_id = p_branch_id
    and (c.created_at at time zone coalesce(v_timezone, 'UTC'))::date between p_start_date and p_end_date
  group by c.reason_code_id, rc.key

  union all

  select 'refund'::text, r.reason_code_id, rc.key, sum(r.amount_minor)::integer, count(*)::integer
  from public.refunds r
  join public.reason_codes rc on rc.id = r.reason_code_id
  where r.tenant_id = v_tenant_id and r.branch_id = p_branch_id
    and (r.created_at at time zone coalesce(v_timezone, 'UTC'))::date between p_start_date and p_end_date
  group by r.reason_code_id, rc.key

  union all

  select 'cancel'::text, o.cancel_reason_code_id, rc.key, coalesce(sum(o.subtotal_minor), 0)::integer, count(*)::integer
  from public.orders o
  left join public.reason_codes rc on rc.id = o.cancel_reason_code_id
  where o.tenant_id = v_tenant_id and o.branch_id = p_branch_id and o.status = 'cancelled'
    and (o.updated_at at time zone coalesce(v_timezone, 'UTC'))::date between p_start_date and p_end_date
  group by o.cancel_reason_code_id, rc.key;
end;
$$;
revoke all on function public.get_loss_report(uuid, date, date) from public;
grant execute on function public.get_loss_report(uuid, date, date) to authenticated;
