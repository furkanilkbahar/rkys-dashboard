-- Faz 9 Adım 2 (S40): kurye modülü. profiles.role zaten 'courier'ı
-- kapsıyordu (0003) ve /admin/staff zaten STAFF_MANAGEABLE_ROLES'ta 'courier'
-- listeliyordu (kod tarafı) — bu adım yalnızca atama/durum takibi RPC'lerini
-- ve kurye-özel /courier yüzeyini ekliyor.

create table public.courier_assignments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  order_id uuid not null unique references public.orders(id) on delete cascade,
  courier_id uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'assigned' check (status in ('assigned', 'en_route', 'delivered')),
  assigned_at timestamptz not null default now(),
  en_route_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_courier_assignments_tenant_id on public.courier_assignments(tenant_id);
create index idx_courier_assignments_courier_id on public.courier_assignments(courier_id);
alter table public.courier_assignments enable row level security;
create policy "courier_assignments_select" on public.courier_assignments for select
  using (tenant_id = public.current_tenant_id() and public.is_staff());
grant select on public.courier_assignments to authenticated;
grant all on public.courier_assignments to service_role;

-- assign_courier: yalnızca delivery kanalındaki siparişlere, yalnızca aynı
-- tenant'ta role='courier' olan bir profile atanabilir. Zaten atanmışsa
-- kurye değiştirmeye izin verir (upsert), teslim edilmiş bir siparişin
-- kuryesi değiştirilemez (RULES #18 ruhu: tamamlanmış iş geriye dönük
-- değişmez).
create or replace function public.assign_courier(p_order_id uuid, p_courier_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid := public.current_tenant_id();
  v_branch_id uuid;
  v_channel text;
  v_courier_role text;
  v_assignment_id uuid;
  v_existing_status text;
begin
  if not public.is_staff() then
    raise exception 'staff only';
  end if;

  select branch_id, channel into v_branch_id, v_channel
  from public.orders where id = p_order_id and tenant_id = v_tenant_id;
  if v_branch_id is null then
    raise exception 'order not found';
  end if;
  if v_channel <> 'delivery' then
    raise exception 'order is not a delivery order';
  end if;

  select role into v_courier_role from public.profiles where id = p_courier_id and tenant_id = v_tenant_id;
  if v_courier_role is distinct from 'courier' then
    raise exception 'invalid courier';
  end if;

  select id, status into v_assignment_id, v_existing_status from public.courier_assignments where order_id = p_order_id for update;
  if v_existing_status = 'delivered' then
    raise exception 'order already delivered';
  end if;

  if v_assignment_id is null then
    insert into public.courier_assignments (tenant_id, branch_id, order_id, courier_id)
    values (v_tenant_id, v_branch_id, p_order_id, p_courier_id)
    returning id into v_assignment_id;
  else
    update public.courier_assignments set courier_id = p_courier_id where id = v_assignment_id;
  end if;

  return v_assignment_id;
end;
$$;
revoke all on function public.assign_courier(uuid, uuid) from public;
grant execute on function public.assign_courier(uuid, uuid) to authenticated;

-- advance_courier_assignment: advance_order_status (0017) ile aynı desen —
-- sabit kodlu legal-next-status haritası, atlama reddedilir.
create or replace function public.advance_courier_assignment(p_assignment_id uuid, p_to_status text)
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

  select status into v_status from public.courier_assignments
  where id = p_assignment_id and tenant_id = public.current_tenant_id()
  for update;
  if not found then
    raise exception 'assignment not found';
  end if;

  v_legal_next := case v_status
    when 'assigned' then 'en_route'
    when 'en_route' then 'delivered'
    else null
  end;
  if v_legal_next is null or p_to_status <> v_legal_next then
    raise exception 'ILLEGAL_TRANSITION:% -> %', v_status, p_to_status;
  end if;

  update public.courier_assignments
  set status = p_to_status,
      en_route_at = case when p_to_status = 'en_route' then now() else en_route_at end,
      delivered_at = case when p_to_status = 'delivered' then now() else delivered_at end
  where id = p_assignment_id;
end;
$$;
revoke all on function public.advance_courier_assignment(uuid, text) from public;
grant execute on function public.advance_courier_assignment(uuid, text) to authenticated;

-- get_courier_daily_summary: "kurye gün sonu özeti" (PRD) — teslim edilen
-- sipariş sayısı + toplam sipariş tutarı, tenant saat dilimine göre
-- business_date (get_shifts_for_date, 0035, ile aynı desen).
create or replace function public.get_courier_daily_summary(p_courier_id uuid, p_business_date date)
returns table(delivered_count integer, total_amount_minor integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid := public.current_tenant_id();
  v_timezone text;
begin
  if not public.is_staff() then
    raise exception 'staff only';
  end if;
  select timezone into v_timezone from public.tenants where id = v_tenant_id;

  return query
  select count(*)::integer, coalesce(sum(o.subtotal_minor), 0)::integer
  from public.courier_assignments ca
  join public.orders o on o.id = ca.order_id
  where ca.tenant_id = v_tenant_id and ca.courier_id = p_courier_id and ca.status = 'delivered'
    and (ca.delivered_at at time zone coalesce(v_timezone, 'UTC'))::date = p_business_date;
end;
$$;
revoke all on function public.get_courier_daily_summary(uuid, date) from public;
grant execute on function public.get_courier_daily_summary(uuid, date) to authenticated;
