-- Faz 11 Adım 2 (S47): Vardiya planlama + puantaj (D63).
--
-- PRD.md §Faz 11: "haftalık çizelge, PIN ile giriş-çıkış (mevcut vardiya
-- PIN'i puantaja uzanır), çalışma saati raporu, maaş dönemi exportu."
--
-- Kritik keşif: "yetkili cihaz + PIN" mekanizması (RULES #29, D26) Faz 2'de
-- YARIM kaldı — staff_devices (0004) + create_staff_device/revoke_staff_
-- device RPC'leri (0026) ve admin UI'ı (/admin/staff) zaten var (admin bir
-- cihaz için ham secret üretip GÖSTERİR), ama cihaz tarafının bu secret'ı
-- DOĞRULAYAN hiçbir RPC'si veya personel tarafı PIN giriş ekranı hiç inşa
-- edilmemişti. Bu migration eksik parçayı tamamlar: verify_staff_device
-- (cihaz kurulum sayfası bunu kullanır) + clock_in_or_out (PIN giriş-çıkış).
--
-- Güvenlik: clock_in_or_out çağrısı HER SEFERİNDE cihaz secret'ını yeniden
-- doğrular (yalnızca kurulumda değil) — RULES #29 "yetkisiz cihazda PIN
-- girişi çalışmaz" kuralı, cihaz sonradan revoke edilirse (is_active=false)
-- anında etkili olsun diye böyle tasarlandı.
create table public.staff_shifts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  shift_date date not null,
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now()
);
create index idx_staff_shifts_tenant_branch_date on public.staff_shifts(tenant_id, branch_id, shift_date);

alter table public.staff_shifts enable row level security;
create policy "staff_shifts_staff_all" on public.staff_shifts for all
  using (tenant_id = public.current_tenant_id() and public.is_staff())
  with check (tenant_id = public.current_tenant_id() and public.is_staff());
grant select, insert, update, delete on public.staff_shifts to authenticated, service_role;

-- clock_in_or_out yalnızca service_role'den (cihaz secret'ıyla kimliklenmiş,
-- Supabase oturumu OLMAYAN bir istek) çağrıldığı için satır ekleme/güncelleme
-- RPC üzerinden yapılır; authenticated'e yalnızca SELECT (admin raporu için).
create table public.timeclock_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  device_id uuid references public.staff_devices(id) on delete set null,
  clock_in_at timestamptz not null default now(),
  clock_out_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_timeclock_entries_tenant_branch on public.timeclock_entries(tenant_id, branch_id);
create index idx_timeclock_entries_profile_open on public.timeclock_entries(profile_id) where clock_out_at is null;

alter table public.timeclock_entries enable row level security;
create policy "timeclock_entries_staff_select" on public.timeclock_entries for select
  using (tenant_id = public.current_tenant_id() and public.is_staff());
grant select on public.timeclock_entries to authenticated;
grant select, insert, update on public.timeclock_entries to service_role;

-- verify_staff_device: cihaz kurulum sayfası (/vardiya/kurulum) bir ham
-- secret alır, hangi cihaza ait olduğunu (device_id döner) bulur — admin
-- ekranı yalnızca secret'ı gösterdiği için (create_staff_device, 0026)
-- kurulum tarafı device_id'yi baştan bilemez, bu yüzden tenant içindeki
-- aktif cihazlar arasında crypt() ile eşleşen taranır (tenant başına
-- personel cihaz sayısı küçük, performans sorunu değil).
create or replace function public.verify_staff_device(p_tenant_id uuid, p_secret text)
returns uuid
language plpgsql
set search_path = public, extensions
as $$
declare
  v_device_id uuid;
begin
  select id into v_device_id
  from public.staff_devices
  where tenant_id = p_tenant_id and is_active = true and device_secret_hash = crypt(p_secret, device_secret_hash)
  limit 1;

  return v_device_id;
end;
$$;
revoke all on function public.verify_staff_device(uuid, text) from public;
grant execute on function public.verify_staff_device(uuid, text) to service_role;

create or replace function public.clock_in_or_out(p_tenant_id uuid, p_device_id uuid, p_device_secret text, p_pin text)
returns table(action text, badge_no text)
language plpgsql
set search_path = public, extensions
as $$
declare
  v_branch_id uuid;
  v_profile record;
  v_open_entry_id uuid;
begin
  if not exists (
    select 1 from public.tenant_modules where tenant_id = p_tenant_id and module_key = 'staff_scheduling' and is_enabled = true
  ) then
    raise exception 'staff_scheduling module not enabled';
  end if;

  select branch_id into v_branch_id
  from public.staff_devices
  where id = p_device_id and tenant_id = p_tenant_id and is_active = true and device_secret_hash = crypt(p_device_secret, device_secret_hash);
  if v_branch_id is null then
    raise exception 'invalid device';
  end if;

  select p.id, p.badge_no into v_profile
  from public.profiles p
  where p.tenant_id = p_tenant_id and p.is_active = true and p.pin_hash is not null and p.pin_hash = crypt(p_pin, p.pin_hash)
  limit 1;
  if v_profile.id is null then
    raise exception 'invalid pin';
  end if;

  select id into v_open_entry_id
  from public.timeclock_entries
  where profile_id = v_profile.id and clock_out_at is null
  order by clock_in_at desc
  limit 1;

  if v_open_entry_id is not null then
    update public.timeclock_entries set clock_out_at = now() where id = v_open_entry_id;
    return query select 'out'::text, v_profile.badge_no;
  else
    insert into public.timeclock_entries (tenant_id, branch_id, profile_id, device_id)
    values (p_tenant_id, v_branch_id, v_profile.id, p_device_id);
    return query select 'in'::text, v_profile.badge_no;
  end if;
end;
$$;
revoke all on function public.clock_in_or_out(uuid, uuid, text, text) from public;
grant execute on function public.clock_in_or_out(uuid, uuid, text, text) to service_role;
