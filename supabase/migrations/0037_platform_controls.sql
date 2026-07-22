-- Faz 4 Adım 1: Süper Admin tenant kontrolü + duyuru + 2FA anahtarı zemini.

-- suspend_tenant/reactivate_tenant: tenants.status'u doğrudan authenticated
-- update'e açmak yerine (platform admin başka kolonları da kazara
-- değiştirebilir) tek amaçlı, adı açık RPC'ler üzerinden — staff-management
-- RPC'lerindeki (0026) desenle aynı.
create or replace function public.suspend_tenant(p_tenant_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'platform admin only';
  end if;

  update public.tenants set status = 'suspended' where id = p_tenant_id;
  if not found then
    raise exception 'tenant not found';
  end if;
end;
$$;
revoke all on function public.suspend_tenant(uuid) from public;
grant execute on function public.suspend_tenant(uuid) to authenticated;

create or replace function public.reactivate_tenant(p_tenant_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'platform admin only';
  end if;

  update public.tenants set status = 'active' where id = p_tenant_id;
  if not found then
    raise exception 'tenant not found';
  end if;
end;
$$;
revoke all on function public.reactivate_tenant(uuid) from public;
grant execute on function public.reactivate_tenant(uuid) to authenticated;

-- announcements: Süper Admin'in yazdığı, admin panelinde banner olarak
-- gösterilen duyurular (planlı bakım vb.) — incidents (Adım 7, gerçekleşmiş
-- kesinti geçmişi) ile karışmasın diye kasıtlı olarak ayrı tablo.
-- getCurrentActor/getCurrentGuestSession'ın tenant askıya alma kontrolü için:
-- tenants_select_own (0007) is_staff() zorunlu kıldığından misafir kendi
-- tenant satırını doğrudan SELECT edemez — resolve_tenant_by_domain (0002)
-- ile aynı gerekçeyle, yalnızca ihtiyaç duyulan tek bit'i (aktif mi) dönen
-- minimal bir SECURITY DEFINER RPC.
create or replace function public.is_tenant_active(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select status = 'active' from public.tenants where id = p_tenant_id), false)
$$;
grant execute on function public.is_tenant_active(uuid) to authenticated;

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.announcements enable row level security;

create policy "announcements_platform_admin_all"
  on public.announcements for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "announcements_select_active"
  on public.announcements for select
  using (
    is_active
    and starts_at <= now()
    and (ends_at is null or ends_at >= now())
  );

grant select, insert, update, delete on public.announcements to authenticated, service_role;

-- platform_settings: tekil satır (id boolean primary key + check(id), yalnızca
-- `true` değeri kabul edilir → ikinci satır PK ihlaliyle engellenir). Faz
-- 4 Adım 1 kapsamı yalnızca enforce_2fa bayrağının zemini; gerçek TOTP
-- akışı sonraki bir adımda ele alınacak.
create table public.platform_settings (
  id boolean primary key default true,
  enforce_2fa boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint platform_settings_singleton check (id)
);

alter table public.platform_settings enable row level security;

create policy "platform_settings_platform_admin_all"
  on public.platform_settings for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

grant select, insert, update on public.platform_settings to authenticated, service_role;

insert into public.platform_settings (id, enforce_2fa) values (true, false)
on conflict (id) do nothing;
