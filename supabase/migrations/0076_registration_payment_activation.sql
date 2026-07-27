-- Faz 4 revizyonu Adım 3: ödeme onayı ile kayıt onayının bağlanması (S52).
-- activate_subscription (0039) genişletiliyor: abonelik aktivasyonunun
-- ardından, EĞER ilişkili tenant hâlâ 'pending_approval' durumundaysa VE
-- platform_settings.auto_approve_registrations=true İSE, tenant da 'active'
-- yapılır ve planının modülleri açılır. Zaten aktif bir tenant için (normal
-- aylık yenileme webhook'u) bu UPDATE'in WHERE koşulu hiç eşleşmediğinden
-- davranış değişmez.
create or replace function public.activate_subscription(p_provider text, p_provider_ref text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_subscription record;
begin
  select id, tenant_id, status into v_subscription
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
end;
$$;
