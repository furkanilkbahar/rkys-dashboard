-- Faz 16 Adım 1 (S66): kurye canlı konum takibi. Bir kurye aynı anda birden
-- fazla teslimat taşıyabildiği için konum courier_assignments'a değil,
-- kurye (profile) başına tek satıra bağlanır — courier_id üzerinde unique.
create table public.courier_locations (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  courier_id uuid primary key references public.profiles(id) on delete cascade,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  updated_at timestamptz not null default now()
);
create index idx_courier_locations_tenant_id on public.courier_locations(tenant_id);
alter table public.courier_locations enable row level security;

-- Harita görünümü için tüm tenant personeli (owner/manager/waiter/courier)
-- kendi tenant'ındaki tüm kuryelerin konumunu görebilir; yazma yalnızca
-- RPC üzerinden (RULES #5).
create policy "courier_locations_select" on public.courier_locations for select
  using (tenant_id = public.current_tenant_id() and public.is_staff());
grant select on public.courier_locations to authenticated;
grant all on public.courier_locations to service_role;

-- update_courier_location: yalnızca role='courier' olan, kendi konumunu
-- günceller (advance_courier_assignment'taki owner/manager muafiyeti burada
-- yok — konum yalnızca fiziksel olarak o kuryenin cihazından gelebilir).
create or replace function public.update_courier_location(p_latitude double precision, p_longitude double precision)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid := public.current_tenant_id();
begin
  if public.current_role() <> 'courier' then
    raise exception 'courier only';
  end if;
  if not exists (
    select 1 from public.tenant_modules where tenant_id = v_tenant_id and module_key = 'courier' and is_enabled = true
  ) then
    raise exception 'courier module not enabled';
  end if;

  insert into public.courier_locations (tenant_id, courier_id, latitude, longitude, updated_at)
  values (v_tenant_id, auth.uid(), p_latitude, p_longitude, now())
  on conflict (courier_id) do update
    set latitude = excluded.latitude, longitude = excluded.longitude, updated_at = now();
end;
$$;
revoke all on function public.update_courier_location(double precision, double precision) from public;
grant execute on function public.update_courier_location(double precision, double precision) to authenticated;

-- Harita canlı güncellensin diye Realtime publication'a eklenir (bkz. 0021).
alter publication supabase_realtime add table public.courier_locations;
