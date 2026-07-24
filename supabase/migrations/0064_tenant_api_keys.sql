-- Faz 10 Adım 0 (S41): tenant API — API key yönetimi + read-only API'nin
-- veritabanı tarafı. D62: "API key + imzalı webhooks + read API (Faz 10);
-- yazma API'si pazar yeri altyapısıyla" — bu adım yalnızca READ API'yi
-- kapsar.
--
-- Mimari not: API isteklerinin Supabase JWT/cookie oturumu YOKTUR — bir
-- Next.js route handler, Authorization header'daki ham anahtarı hash'leyip
-- service_role ile bu tabloyu sorgular (tables.qr_token_hash ile aynı
-- desen). RLS normal personel/misafir erişimi için kalır (staff select),
-- ama API'nin KENDİSİ service_role üzerinden çalıştığı için tenant izolasyonu
-- RLS'e değil, route handler'ın sorgularına EXPLICIT tenant_id filtresi
-- eklemesine dayanır (lib/api/queries.ts) — bu noktada RLS'in sağladığı
-- "unutursan otomatik engellenir" güvenlik ağı YOKTUR, dikkatli olunmalı.

create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  key_hash text not null unique,
  key_prefix text not null,
  is_active boolean not null default true,
  last_used_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index idx_api_keys_tenant_id on public.api_keys(tenant_id);
alter table public.api_keys enable row level security;
create policy "api_keys_select" on public.api_keys for select
  using (tenant_id = public.current_tenant_id() and public.is_staff());
create policy "api_keys_staff_write" on public.api_keys for all
  using (tenant_id = public.current_tenant_id() and public.is_staff())
  with check (tenant_id = public.current_tenant_id() and public.is_staff());
grant select, insert, update, delete on public.api_keys to authenticated;
grant all on public.api_keys to service_role;

-- authenticate_api_key: ham anahtarın hash'ini alıp aktif+api_access modülü
-- açık bir tenant'a çözer, last_used_at günceller. service_role'e açık
-- (route handler'ın tek çağırıcısı) — authenticated/anon'a hiç GRANT yok,
-- aksi halde herhangi bir oturum açmış kullanıcı başka tenant'ların anahtar
-- hash'lerini kaba kuvvetle deneyebilirdi.
create or replace function public.authenticate_api_key(p_key_hash text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_key_id uuid;
begin
  select id, tenant_id into v_key_id, v_tenant_id
  from public.api_keys
  where key_hash = p_key_hash and is_active = true;

  if v_tenant_id is null then
    return null;
  end if;

  if not exists (
    select 1 from public.tenant_modules
    where tenant_id = v_tenant_id and module_key = 'api_access' and is_enabled = true
  ) then
    return null;
  end if;

  update public.api_keys set last_used_at = now() where id = v_key_id;

  return v_tenant_id;
end;
$$;
revoke all on function public.authenticate_api_key(text) from public;
grant execute on function public.authenticate_api_key(text) to service_role;
