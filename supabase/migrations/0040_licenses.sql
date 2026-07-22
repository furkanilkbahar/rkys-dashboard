-- Faz 4 Adım 4: lisans modülü (lifetime/self-hosted).
-- İmzalama/doğrulama Node crypto ile uygulama katmanında yapılır (lib/licensing/)
-- — bu tablo yalnızca üretilen lisansların kaydını tutar, DB kendi imza
-- doğrulaması yapmaz.

create table public.licenses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  license_type text not null check (license_type in ('lifetime', 'self_hosted')),
  license_key text not null unique,
  issued_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_licenses_tenant_id on public.licenses(tenant_id);

alter table public.licenses enable row level security;

create policy "licenses_platform_admin_all"
  on public.licenses for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

grant select, insert, update, delete on public.licenses to authenticated, service_role;
