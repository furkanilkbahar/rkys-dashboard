-- Faz 4 revizyonu Adım 2: platform admin onay kuyruğu RPC'leri (S51).
-- suspend_tenant/reactivate_tenant (0037) deseninin birebir klonu.

create or replace function public.approve_tenant(p_tenant_id uuid)
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

  perform public.seed_tenant_modules_from_plan(p_tenant_id);
end;
$$;
revoke all on function public.approve_tenant(uuid) from public;
grant execute on function public.approve_tenant(uuid) to authenticated;

create or replace function public.reject_tenant(p_tenant_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'platform admin only';
  end if;

  update public.tenants set status = 'rejected' where id = p_tenant_id;
  if not found then
    raise exception 'tenant not found';
  end if;
end;
$$;
revoke all on function public.reject_tenant(uuid) from public;
grant execute on function public.reject_tenant(uuid) to authenticated;
