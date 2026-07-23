-- Faz 5 Adım 3: aylık ciro hedefi + gecelik anomali taraması (S23).
-- goals/anomaly_alerts, day_closures/daily_sales_summary ile aynı select-only
-- RLS + RPC-mediated-write deseni (RPC'ler postgres sahipliğinde SECURITY
-- DEFINER olduğundan RLS'i bypass eder, tıpkı record_comp/close_business_day
-- gibi — authenticated'a insert/update grant'i yok).

create table public.goals (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  period_month date not null,
  target_revenue_minor integer not null check (target_revenue_minor >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, branch_id, period_month)
);
create index idx_goals_tenant_id on public.goals(tenant_id);
alter table public.goals enable row level security;
create policy "goals_select" on public.goals for select
  using (tenant_id = public.current_tenant_id() and public.is_staff());
grant select on public.goals to authenticated;
grant select, insert, update, delete on public.goals to service_role;

create table public.anomaly_alerts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  business_date date not null,
  message text not null,
  acknowledged_at timestamptz,
  created_at timestamptz not null default now(),
  unique (tenant_id, branch_id, business_date)
);
create index idx_anomaly_alerts_tenant_id on public.anomaly_alerts(tenant_id);
alter table public.anomaly_alerts enable row level security;
create policy "anomaly_alerts_select" on public.anomaly_alerts for select
  using (tenant_id = public.current_tenant_id() and public.is_staff());
grant select on public.anomaly_alerts to authenticated;
grant select, insert, update, delete on public.anomaly_alerts to service_role;

-- set_monthly_goal: p_period_month'un GÜN kısmı yok sayılır, ayın 1'ine
-- normalize edilir (unique kısıtı ay bazlı) — aynı ay için ikinci çağrı hedefi
-- günceller (upsert).
create or replace function public.set_monthly_goal(p_branch_id uuid, p_period_month date, p_target_revenue_minor integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid := public.current_tenant_id();
  v_month_start date := date_trunc('month', p_period_month)::date;
begin
  if not public.current_can('reports.revenue') then
    raise exception 'forbidden';
  end if;
  if p_target_revenue_minor < 0 then
    raise exception 'invalid amount';
  end if;

  insert into public.goals (tenant_id, branch_id, period_month, target_revenue_minor)
  values (v_tenant_id, p_branch_id, v_month_start, p_target_revenue_minor)
  on conflict (tenant_id, branch_id, period_month)
  do update set target_revenue_minor = excluded.target_revenue_minor, updated_at = now();
end;
$$;
revoke all on function public.set_monthly_goal(uuid, date, integer) from public;
grant execute on function public.set_monthly_goal(uuid, date, integer) to authenticated;

-- get_goal_progress: hedef yoksa target_revenue_minor 0 döner (UI "hedef
-- belirlenmemiş" olarak yorumlar); actual_revenue_minor yalnızca KAPATILMIŞ
-- günlerin toplamıdır (daily_sales_summary), bugünün henüz kapanmamış cirosu
-- dahil değildir — day_closures/daily_sales_summary'nin "yalnızca kapanan
-- günler" ilkesiyle tutarlı.
create or replace function public.get_goal_progress(p_branch_id uuid, p_period_month date)
returns table(target_revenue_minor integer, actual_revenue_minor integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid := public.current_tenant_id();
  v_month_start date := date_trunc('month', p_period_month)::date;
  v_month_end date := (date_trunc('month', p_period_month) + interval '1 month' - interval '1 day')::date;
begin
  if not public.current_can('reports.revenue') then
    raise exception 'forbidden';
  end if;

  return query
  select
    coalesce((
      select g.target_revenue_minor from public.goals g
      where g.tenant_id = v_tenant_id and g.branch_id = p_branch_id and g.period_month = v_month_start
    ), 0)::integer,
    coalesce((
      select sum(dss.revenue_minor) from public.daily_sales_summary dss
      where dss.tenant_id = v_tenant_id and dss.branch_id = p_branch_id
        and dss.business_date between v_month_start and v_month_end
    ), 0)::integer;
end;
$$;
revoke all on function public.get_goal_progress(uuid, date) from public;
grant execute on function public.get_goal_progress(uuid, date) to authenticated;

create or replace function public.get_active_anomaly_alerts(p_branch_id uuid)
returns table(id uuid, business_date date, message text, created_at timestamptz)
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
  select aa.id, aa.business_date, aa.message, aa.created_at
  from public.anomaly_alerts aa
  where aa.tenant_id = v_tenant_id and aa.branch_id = p_branch_id and aa.acknowledged_at is null
  order by aa.business_date desc;
end;
$$;
revoke all on function public.get_active_anomaly_alerts(uuid) from public;
grant execute on function public.get_active_anomaly_alerts(uuid) to authenticated;

create or replace function public.acknowledge_anomaly_alert(p_alert_id uuid)
returns void
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

  update public.anomaly_alerts set acknowledged_at = now()
  where id = p_alert_id and tenant_id = v_tenant_id;
  if not found then
    raise exception 'not found';
  end if;
end;
$$;
revoke all on function public.acknowledge_anomaly_alert(uuid) from public;
grant execute on function public.acknowledge_anomaly_alert(uuid) to authenticated;

-- detect_revenue_anomalies: her (tenant, branch, business_date) için henüz
-- bir anomaly_alerts kaydı YOKSA, o günün cirosunu aynı haftanın gününün son
-- 4 haftalık ortalamasıyla (daily_sales_summary) kıyaslar; %30+ düşüşte
-- uyarı satırı açar. pg_cron ile gecelik çalışır (0019 ile aynı desen) —
-- yalnızca service_role tarafından çağrılabilir.
create or replace function public.detect_revenue_anomalies()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_avg numeric;
begin
  for r in
    select dss.tenant_id, dss.branch_id, dss.business_date, dss.revenue_minor
    from public.daily_sales_summary dss
    where not exists (
      select 1 from public.anomaly_alerts aa
      where aa.tenant_id = dss.tenant_id and aa.branch_id = dss.branch_id and aa.business_date = dss.business_date
    )
  loop
    select avg(revenue_minor) into v_avg
    from public.daily_sales_summary
    where tenant_id = r.tenant_id and branch_id = r.branch_id
      and business_date < r.business_date
      and business_date >= r.business_date - 28
      and extract(dow from business_date) = extract(dow from r.business_date);

    if v_avg is not null and v_avg > 0 and r.revenue_minor < v_avg * 0.7 then
      insert into public.anomaly_alerts (tenant_id, branch_id, business_date, message)
      values (
        r.tenant_id, r.branch_id, r.business_date,
        format('Ciro, son 4 haftanın aynı gün ortalamasına göre %s%% düştü', round((1 - r.revenue_minor / v_avg) * 100))
      );
    end if;
  end loop;
end;
$$;
revoke all on function public.detect_revenue_anomalies() from public, authenticated, anon;
grant execute on function public.detect_revenue_anomalies() to service_role;

select cron.schedule(
  'detect-revenue-anomalies',
  '0 3 * * *',
  $$select public.detect_revenue_anomalies()$$
);
