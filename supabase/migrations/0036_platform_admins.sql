-- Faz 4 Adım 0: Süper Admin temeli. platform_admins tenant-scoped DEĞİLDİR
-- (RULES'un "her tabloda tenant_id" kuralı platform-seviyesi tablolara
-- uygulanmaz — ARCHITECTURE.md'nin "Platform" grubu bu şekilde tasarlandı).
-- RLS enable edilir ama HİÇBİR policy eklenmez: authenticated hiçbir zaman
-- bu tabloyu doğrudan sorgulayamaz, yalnızca custom_access_token_hook
-- (security definer, postgres sahipliği ile RLS bypass eder) ve service_role
-- (bypassrls) erişebilir — is_platform_admin() (0001) stub'ının beklediği
-- gerçek veri kaynağı burası.
create table public.platform_admins (
  id uuid primary key references auth.users(id) on delete cascade,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.platform_admins enable row level security;
grant select, insert, update, delete on public.platform_admins to service_role;

-- custom_access_token_hook (0006, 0012'de misafir dalı eklendi) üçüncü bir
-- dala genişletilir: ne profiles'ta ne table_session_devices'ta eşleşme
-- varsa platform_admins kontrol edilir. Personel/misafir dallarına hiç
-- dokunulmadı — yalnızca else'in içine yeni bir else eklendi.
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  claims jsonb;
  profile record;
  guest record;
  admin record;
begin
  claims := event -> 'claims';

  select tenant_id, role into profile
  from public.profiles
  where id = (event ->> 'user_id')::uuid;

  if profile.tenant_id is not null then
    claims := jsonb_set(claims, '{tenant_id}', to_jsonb(profile.tenant_id::text));
    claims := jsonb_set(claims, '{user_role}', to_jsonb(profile.role));
  else
    select tenant_id, branch_id, table_session_id into guest
    from public.table_session_devices
    where guest_user_id = (event ->> 'user_id')::uuid;

    if guest.tenant_id is not null then
      claims := jsonb_set(claims, '{tenant_id}', to_jsonb(guest.tenant_id::text));
      claims := jsonb_set(claims, '{user_role}', to_jsonb('guest'::text));
      claims := jsonb_set(claims, '{branch_id}', to_jsonb(guest.branch_id::text));
      claims := jsonb_set(claims, '{table_session_id}', to_jsonb(guest.table_session_id::text));
    else
      select is_active into admin
      from public.platform_admins
      where id = (event ->> 'user_id')::uuid;

      if admin.is_active then
        claims := jsonb_set(claims, '{user_role}', to_jsonb('platform_admin'::text));
        claims := jsonb_set(claims, '{is_platform_admin}', to_jsonb(true));
      end if;
    end if;
  end if;

  event := jsonb_set(event, '{claims}', claims);
  return event;
end;
$$;
