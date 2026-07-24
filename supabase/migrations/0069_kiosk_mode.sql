-- Faz 11 Adım 1 (S46): Kiosk modu (D63).
--
-- PRD.md §Faz 11: "tablet self-servis sipariş (QR menünün dokunmatik/büyük
-- ekran modu; kod yeniden kullanımı)". Mimari karar: kiosk AYRI bir
-- table_sessions.channel değeri almaz — bir kiosk siparişi işlevsel olarak
-- gel-al (pickup) ile birebir aynıdır (müşteri sipariş verir, bir kod alır,
-- hazır olunca teslim alır). Bu yüzden open_kiosk_session, open_pickup_
-- session'ın (0061) BİREBİR gövdesini klonlar — yalnızca modül kontrolü
-- 'kiosk' olur ve oturuma hangi fiziksel tabletten geldiği (kiosk_device_id)
-- eklenir. Misafir tarafı sipariş sayfası da AYNI /paket sayfasıdır (kod
-- yeniden kullanımı ilkesi harfiyen uygulanır) — yalnızca /kiosk/[pairingCode]
-- bootstrap ucu farklıdır.
create table public.kiosk_devices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  device_name text not null,
  pairing_code text not null,
  is_active boolean not null default true,
  last_active_at timestamptz,
  created_at timestamptz not null default now(),
  unique (tenant_id, pairing_code)
);
create index idx_kiosk_devices_tenant_id on public.kiosk_devices(tenant_id);

alter table public.kiosk_devices enable row level security;
create policy "kiosk_devices_staff_all" on public.kiosk_devices for all
  using (tenant_id = public.current_tenant_id() and public.is_staff())
  with check (tenant_id = public.current_tenant_id() and public.is_staff());
grant select, insert, update, delete on public.kiosk_devices to authenticated, service_role;

alter table public.table_sessions add column kiosk_device_id uuid references public.kiosk_devices(id) on delete set null;

create or replace function public.open_kiosk_session(p_tenant_id uuid, p_pairing_code text)
returns table(table_session_id uuid, pickup_code text)
language plpgsql
as $$
declare
  v_branch_id uuid;
  v_device_id uuid;
  v_id uuid;
  v_code text;
begin
  if not exists (
    select 1 from public.tenant_modules where tenant_id = p_tenant_id and module_key = 'kiosk' and is_enabled = true
  ) then
    raise exception 'kiosk module not enabled';
  end if;

  select id, branch_id into v_device_id, v_branch_id
  from public.kiosk_devices
  where tenant_id = p_tenant_id and pairing_code = p_pairing_code and is_active = true;
  if v_device_id is null then
    raise exception 'invalid kiosk device';
  end if;

  v_code := upper(substr(md5(gen_random_uuid()::text), 1, 6));

  insert into public.table_sessions (tenant_id, branch_id, table_id, channel, pickup_code, kiosk_device_id)
  values (p_tenant_id, v_branch_id, null, 'pickup', v_code, v_device_id)
  returning id into v_id;

  insert into public.session_events (tenant_id, branch_id, table_session_id, event_type)
  values (p_tenant_id, v_branch_id, v_id, 'opened');

  update public.kiosk_devices set last_active_at = now() where id = v_device_id;

  return query select v_id, v_code;
end;
$$;
revoke all on function public.open_kiosk_session(uuid, text) from public;
grant execute on function public.open_kiosk_session(uuid, text) to service_role;
