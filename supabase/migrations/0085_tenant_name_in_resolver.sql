-- resolve_tenant_by_domain (0052) dönüş tipi genişliyor — admin panelinde
-- firma adının (rol/slug/UUID değil) header üzerinden gösterilebilmesi için
-- tenant_name eklendi.
drop function public.resolve_tenant_by_domain(text);

create or replace function public.resolve_tenant_by_domain(p_domain text)
returns table(tenant_id uuid, tenant_slug text, tenant_name text, tenant_status text, tenant_currency text, tenant_theme_key text)
language sql
stable
security definer
set search_path = public
as $$
  select t.id, t.slug, t.name, t.status, t.currency, s.theme_key
  from public.tenant_domains d
  join public.tenants t on t.id = d.tenant_id
  join public.tenant_settings s on s.tenant_id = t.id
  where d.domain = p_domain
  limit 1
$$;

grant execute on function public.resolve_tenant_by_domain(text) to anon, authenticated;
