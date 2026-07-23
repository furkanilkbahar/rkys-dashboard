-- Faz 7 Adım 3: sadakat/kampanya performans raporları (S33).
-- get_loss_report/get_period_revenue_report (0045) ile aynı ad-hoc RPC
-- deseni — genel bir "analytics" tablosu yok, her rapor kendi RPC'si.
-- reports.revenue izni kullanılır (kayıp-kaçak kadar hassas değil, genel
-- ciro raporlarıyla aynı erişim seviyesi).

create or replace function public.get_loyalty_performance_report(p_start_date date, p_end_date date)
returns table(points_earned integer, points_redeemed integer, active_customers integer, redemption_count integer)
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
    coalesce(sum(case when delta > 0 then delta else 0 end), 0)::integer,
    coalesce(sum(case when delta < 0 then -delta else 0 end), 0)::integer,
    count(distinct customer_id)::integer,
    count(*) filter (where type = 'redeem')::integer
  from public.loyalty_transactions
  where tenant_id = v_tenant_id
    and (created_at at time zone coalesce(v_timezone, 'UTC'))::date between p_start_date and p_end_date;
end;
$$;
revoke all on function public.get_loyalty_performance_report(date, date) from public;
grant execute on function public.get_loyalty_performance_report(date, date) to authenticated;

create or replace function public.get_campaign_performance_report(p_start_date date, p_end_date date)
returns table(campaign_id uuid, campaign_name text, redemption_count integer, total_discount_minor integer)
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
    camp.id,
    camp.name,
    count(cr.id)::integer,
    coalesce(sum(c.amount_minor), 0)::integer
  from public.coupon_redemptions cr
  join public.coupons cp on cp.id = cr.coupon_id
  join public.campaigns camp on camp.id = cp.campaign_id
  left join public.comps c on c.id = cr.comp_id
  where cr.tenant_id = v_tenant_id
    and (cr.created_at at time zone coalesce(v_timezone, 'UTC'))::date between p_start_date and p_end_date
  group by camp.id, camp.name
  order by camp.name;
end;
$$;
revoke all on function public.get_campaign_performance_report(date, date) from public;
grant execute on function public.get_campaign_performance_report(date, date) to authenticated;
