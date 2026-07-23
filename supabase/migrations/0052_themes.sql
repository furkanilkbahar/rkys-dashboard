-- Faz 6 Adım 4: tema yönetimi (S29). tenant_settings.theme_key (0027) o
-- zamandan beri var ama hiç kullanılmıyordu — layout.tsx data-theme'i sabit
-- kodluyordu, ThemeCard salt-okunurdu. Bu migration gerçek bir katalog
-- (ARCHITECTURE.md §6 "public/private atama" ilkesi) ekler.
create table public.themes (
  key text primary key,
  name text not null,
  is_public boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.themes enable row level security;

-- Herkes (staff) public temaları görebilir; platform_admin hepsini görür ve
-- yazabilir (private/gelecekteki tenant'a özel temalar için ayrılmış alan).
create policy "themes_select" on public.themes for select
  using (is_public = true or public.is_platform_admin());
create policy "themes_platform_admin_write" on public.themes for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

grant select on public.themes to authenticated;
grant insert, update, delete on public.themes to authenticated, service_role;

insert into public.themes (key, name, is_public) values
  ('warm-luxury', 'Warm Luxury', true),
  ('sage-bistro', 'Sage Bistro', true);

-- Select'in dışına (doğrudan DB/API) geçersiz bir tema anahtarı atanmasını
-- engeller — themes zaten seed edildiği için mevcut tenant_settings
-- satırlarının default'u ('warm-luxury') FK'ye takılmadan geçer.
alter table public.tenant_settings
  add constraint tenant_settings_theme_key_fkey foreign key (theme_key) references public.themes(key);

-- resolve_tenant_by_domain (0027) dönüş tipi genişliyor — proxy.ts'in
-- data-theme'i header üzerinden (ekstra bir sorgu yapmadan) enjekte
-- edebilmesi için tenant_theme_key eklendi.
drop function public.resolve_tenant_by_domain(text);

create or replace function public.resolve_tenant_by_domain(p_domain text)
returns table(tenant_id uuid, tenant_slug text, tenant_status text, tenant_currency text, tenant_theme_key text)
language sql
stable
security definer
set search_path = public
as $$
  select t.id, t.slug, t.status, t.currency, s.theme_key
  from public.tenant_domains d
  join public.tenants t on t.id = d.tenant_id
  join public.tenant_settings s on s.tenant_id = t.id
  where d.domain = p_domain
  limit 1
$$;

grant execute on function public.resolve_tenant_by_domain(text) to anon, authenticated;
