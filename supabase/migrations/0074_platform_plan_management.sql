-- Faz 4 revizyonu Adım 1: Platform admin plan CRUD RPC'leri (S50).
-- suspend_tenant/assign_tenant_plan (0037/0038) deseninin birebir klonu:
-- is_platform_admin() kontrolü + tek işlem + dar grant.

create or replace function public.create_plan(
  p_key text,
  p_name text,
  p_price_minor integer,
  p_table_limit integer,
  p_included_branch_count integer,
  p_extra_branch_price_minor integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan_id uuid;
begin
  if not public.is_platform_admin() then
    raise exception 'platform admin only';
  end if;

  insert into public.plans (key, name, price_minor, table_limit, included_branch_count, extra_branch_price_minor)
  values (p_key, p_name, p_price_minor, p_table_limit, p_included_branch_count, p_extra_branch_price_minor)
  returning id into v_plan_id;

  return v_plan_id;
end;
$$;
revoke all on function public.create_plan(text, text, integer, integer, integer, integer) from public;
grant execute on function public.create_plan(text, text, integer, integer, integer, integer) to authenticated;

-- key kasıtlı olarak güncellenemiyor: mevcut tenant'ların plan_id FK'ı ve
-- kayıt/billing akışlarındaki referanslar key değil id üzerinden çalışıyor,
-- ama key'in sonradan değişmesi kod içindeki (ör. seed) sabit string
-- karşılaştırmalarını sessizce bozabilir — bu fazın kapsamı dışında.
create or replace function public.update_plan(
  p_plan_id uuid,
  p_name text,
  p_price_minor integer,
  p_table_limit integer,
  p_included_branch_count integer,
  p_extra_branch_price_minor integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'platform admin only';
  end if;

  update public.plans
  set name = p_name,
      price_minor = p_price_minor,
      table_limit = p_table_limit,
      included_branch_count = p_included_branch_count,
      extra_branch_price_minor = p_extra_branch_price_minor
  where id = p_plan_id;

  if not found then
    raise exception 'plan not found';
  end if;
end;
$$;
revoke all on function public.update_plan(uuid, text, integer, integer, integer, integer) from public;
grant execute on function public.update_plan(uuid, text, integer, integer, integer, integer) to authenticated;

create or replace function public.set_plan_module(p_plan_id uuid, p_module_key text, p_included boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'platform admin only';
  end if;

  if p_included then
    insert into public.plan_modules (plan_id, module_key) values (p_plan_id, p_module_key)
    on conflict do nothing;
  else
    delete from public.plan_modules where plan_id = p_plan_id and module_key = p_module_key;
  end if;
end;
$$;
revoke all on function public.set_plan_module(uuid, text, boolean) from public;
grant execute on function public.set_plan_module(uuid, text, boolean) to authenticated;
