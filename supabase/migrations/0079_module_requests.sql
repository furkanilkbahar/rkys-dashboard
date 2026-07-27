-- Faz 4 revizyonu Adım 6: tenant tarafı "Talep Et" akışı (S55).

-- Aynı modül için birden fazla bekleyen talep birikmesin diye (tekrar
-- tıklamalar / eşzamanlı sekmeler) — subscriptions.provider_ref (0039) ile
-- aynı desen: kısmi unique index.
create unique index idx_module_requests_pending_unique
  on public.module_requests (tenant_id, module_key) where status = 'pending';

-- request_module: tenant kendi eksik/plan dışı bir modülü platform admin'in
-- incelemesine sunar. is_staff() + current_tenant_id() — misafir asla
-- çağıramaz, tenant izolasyonu RLS değil doğrudan bu kontrolle sağlanır
-- (module_requests zaten RLS'te aynı koşulu tekrarlıyor, savunma katmanı).
create or replace function public.request_module(p_module_key text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    raise exception 'staff only';
  end if;

  insert into public.module_requests (tenant_id, module_key, status)
  values (public.current_tenant_id(), p_module_key, 'pending');
end;
$$;
revoke all on function public.request_module(text) from public;
grant execute on function public.request_module(text) to authenticated;

-- resolve_module_request: platform admin onaylar/reddeder. Onayda
-- set_tenant_module ile aynı upsert mantığı (source='granted') + talebin
-- durumu güncellenir — tek transaction.
create or replace function public.resolve_module_request(p_request_id uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request record;
begin
  if not public.is_platform_admin() then
    raise exception 'platform admin only';
  end if;

  select id, tenant_id, module_key, status into v_request
  from public.module_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'module request not found';
  end if;

  if v_request.status <> 'pending' then
    raise exception 'module request already resolved';
  end if;

  if p_approve then
    insert into public.tenant_modules (tenant_id, module_key, is_enabled, source)
    values (v_request.tenant_id, v_request.module_key, true, 'granted')
    on conflict (tenant_id, module_key) do update set is_enabled = true, source = 'granted', updated_at = now();
    update public.module_requests set status = 'approved', resolved_at = now() where id = p_request_id;
  else
    update public.module_requests set status = 'rejected', resolved_at = now() where id = p_request_id;
  end if;
end;
$$;
revoke all on function public.resolve_module_request(uuid, boolean) from public;
grant execute on function public.resolve_module_request(uuid, boolean) to authenticated;
