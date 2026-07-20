create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  status text not null default 'active' check (status in ('active', 'suspended')),
  timezone text not null default 'Europe/Istanbul',
  currency text not null default 'TRY',
  created_at timestamptz not null default now()
);

alter table public.tenants enable row level security;

create policy "tenants_select_own"
  on public.tenants for select
  using (id = public.current_tenant_id());

create policy "tenants_platform_admin_all"
  on public.tenants for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- PostgREST also requires a base table GRANT — RLS only filters rows once
-- the operation is already permitted (auto_expose_new_tables defaults off).
grant select, insert, update, delete on public.tenants to authenticated, service_role;

create table public.tenant_domains (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  domain text not null unique,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_tenant_domains_tenant_id on public.tenant_domains(tenant_id);

alter table public.tenant_domains enable row level security;

create policy "tenant_domains_tenant_isolation"
  on public.tenant_domains for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

grant select, insert, update, delete on public.tenant_domains to authenticated, service_role;

-- The tenant middleware resolves a subdomain before the visitor has a JWT
-- (anon request), so it cannot rely on current_tenant_id()/RLS. This
-- SECURITY DEFINER RPC returns only the minimal fields needed to route the
-- request instead of opening the tables to anon SELECT.
create or replace function public.resolve_tenant_by_domain(p_domain text)
returns table(tenant_id uuid, tenant_slug text, tenant_status text)
language sql
stable
security definer
set search_path = public
as $$
  select t.id, t.slug, t.status
  from public.tenant_domains d
  join public.tenants t on t.id = d.tenant_id
  where d.domain = p_domain
  limit 1
$$;

grant execute on function public.resolve_tenant_by_domain(text) to anon, authenticated;
