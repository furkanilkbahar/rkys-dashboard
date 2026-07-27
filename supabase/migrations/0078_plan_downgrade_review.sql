-- Faz 4 revizyonu Adım 5: plan düşürme incelemesi (S54).

-- subscriptions: checkout başlatılırken hangi plana geçileceği burada
-- tutulur — webhook (activate_subscription) ödeme onaylanınca bu planı
-- apply_plan_change ile uygular. Kayıt akışının (Adım 3) doğrudan
-- .update()'i bu kolona hiç dokunmaz (null kalır) — tenant zaten
-- registerTenant'ta doğru plan_id ile kuruluyor, tekrar uygulamaya gerek yok.
alter table public.subscriptions add column pending_plan_id uuid references public.plans(id);

-- set_subscription_checkout_ref: p_plan_id parametresi eklendi (imza
-- değişti, eski 2 parametreli sürüm drop edilip yeniden yaratılıyor —
-- 0055/0050 vb. migration'larla aynı desen).
drop function public.set_subscription_checkout_ref(text, text);

create or replace function public.set_subscription_checkout_ref(p_provider text, p_provider_ref text, p_plan_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    raise exception 'staff only';
  end if;

  update public.subscriptions
  set provider = p_provider, provider_ref = p_provider_ref, pending_plan_id = p_plan_id, updated_at = now()
  where tenant_id = public.current_tenant_id();

  if not found then
    raise exception 'subscription not found';
  end if;
end;
$$;
revoke all on function public.set_subscription_checkout_ref(text, text, uuid) from public;
grant execute on function public.set_subscription_checkout_ref(text, text, uuid) to authenticated;

-- activate_subscription: ödeme onaylandıktan sonra, EĞER checkout bir plan
-- değişikliği için başlatılmışsa (pending_plan_id dolu), paylaşılan
-- apply_plan_change ile bu planı uygular (düşürmede aynı inceleme güvenliği
-- devreye girer, silme yok). Kayıt onayı akışı (Adım 3) hiç dokunulmadı.
create or replace function public.activate_subscription(p_provider text, p_provider_ref text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_subscription record;
  v_target_plan_id uuid;
begin
  select id, tenant_id, status, pending_plan_id into v_subscription
  from public.subscriptions
  where provider = p_provider and provider_ref = p_provider_ref
  for update;

  if not found then
    raise exception 'unknown subscription checkout';
  end if;

  if v_subscription.status <> 'active' then
    update public.subscriptions
    set status = 'active', current_period_end = now() + interval '30 days', updated_at = now()
    where id = v_subscription.id;
  end if;

  update public.tenants
  set status = 'active'
  where id = v_subscription.tenant_id
    and status = 'pending_approval'
    and (select auto_approve_registrations from public.platform_settings where id = true);

  if found then
    perform public.seed_tenant_modules_from_plan(v_subscription.tenant_id);
  end if;

  if v_subscription.pending_plan_id is not null then
    v_target_plan_id := v_subscription.pending_plan_id;
    update public.subscriptions set pending_plan_id = null where id = v_subscription.id;
    perform public.apply_plan_change(v_subscription.tenant_id, v_target_plan_id);
  end if;
end;
$$;

-- assign_tenant_plan (0038): platform admin'in manuel ataması da artık
-- paylaşılan apply_plan_change'i çağırır — düşürmede aynı inceleme güvenliği
-- (pending_removal_since) burada da devreye girsin diye.
create or replace function public.assign_tenant_plan(p_tenant_id uuid, p_plan_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'platform admin only';
  end if;

  if not exists (select 1 from public.tenants where id = p_tenant_id) then
    raise exception 'tenant not found';
  end if;

  perform public.apply_plan_change(p_tenant_id, p_plan_id);
end;
$$;

-- resolve_pending_module_removal: platform admin, pending_removal_since
-- dolu bir modülü Koru/Kaldır kararına bağlar. "Koru" seçilirse modül
-- source='granted' olarak yeniden etiketlenir (Varsayım: bu kararı kalıcı
-- kılan mekanizma — apply_plan_change yalnızca source='plan' satırları
-- işaretlediği için 'granted'e geçen bir satır sonraki düşürmelerde bir
-- daha hiç işaretlenmez, ayrı bir "kalıcı" bayrağına gerek kalmaz).
-- "Kaldır" seçilirse modül gerçekten kapatılır (is_enabled=false).
create or replace function public.resolve_pending_module_removal(p_tenant_id uuid, p_module_key text, p_keep boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'platform admin only';
  end if;

  if p_keep then
    update public.tenant_modules
    set source = 'granted', pending_removal_since = null
    where tenant_id = p_tenant_id and module_key = p_module_key and pending_removal_since is not null;
  else
    update public.tenant_modules
    set is_enabled = false, pending_removal_since = null
    where tenant_id = p_tenant_id and module_key = p_module_key and pending_removal_since is not null;
  end if;

  if not found then
    raise exception 'no pending removal for this module';
  end if;
end;
$$;
revoke all on function public.resolve_pending_module_removal(uuid, text, boolean) from public;
grant execute on function public.resolve_pending_module_removal(uuid, text, boolean) to authenticated;
