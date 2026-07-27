-- Faz 15 Adım 0 (S62): ücretli ek modül ekonomisi. tenant_modules.source=
-- 'paid_addon' (Faz 4 revizyonu) şimdiye kadar yalnızca bir bayraktı — bu
-- migration gerçek bir à la carte satın alma akışına bağlıyor (adisyo/
-- robotPOS'un asıl gelir modeli: taban plan + modül başına ayrı ücret).

-- module_addon_prices: her modülün plan dışında tek başına satın alınabilir
-- fiyatı. price_minor=0 demek "bu modül ayrıca satılmıyor" (yalnızca
-- request_module ile ücretsiz talep akışına açık). plans (0038) ile aynı
-- RLS deseni: herkese açık okunur (tenant fiyatı görmeli), yazma yalnızca
-- platform admin.
create table public.module_addon_prices (
  module_key text primary key check (module_key in (
    'pos_cash', 'inventory', 'recipes', 'crm_loyalty', 'campaigns', 'gift_cards',
    'pickup', 'delivery', 'courier', 'marketplace', 'reservations', 'kiosk',
    'staff_scheduling', 'accounting_export', 'api_access'
  )),
  price_minor integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.module_addon_prices enable row level security;

create policy "module_addon_prices_select_all"
  on public.module_addon_prices for select
  using (true);

create policy "module_addon_prices_platform_admin_write"
  on public.module_addon_prices for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

grant select on public.module_addon_prices to anon, authenticated, service_role;
grant insert, update, delete on public.module_addon_prices to authenticated, service_role;

create or replace function public.set_module_addon_price(p_module_key text, p_price_minor integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'platform admin only';
  end if;

  insert into public.module_addon_prices (module_key, price_minor, updated_at)
  values (p_module_key, p_price_minor, now())
  on conflict (module_key) do update set price_minor = excluded.price_minor, updated_at = now();
end;
$$;
revoke all on function public.set_module_addon_price(text, integer) from public;
grant execute on function public.set_module_addon_price(text, integer) to authenticated;

-- subscriptions: checkout başlatılırken hangi modülün satın alındığı
-- pending_plan_id (0078) ile aynı desende burada tutulur.
alter table public.subscriptions add column pending_addon_module_key text;

-- set_subscription_checkout_ref: p_addon_module_key parametresi eklendi
-- (imza değişti, 0078'deki 3 parametreli sürüm drop edilip yeniden yaratılıyor).
drop function public.set_subscription_checkout_ref(text, text, uuid);

create or replace function public.set_subscription_checkout_ref(
  p_provider text,
  p_provider_ref text,
  p_plan_id uuid default null,
  p_addon_module_key text default null
)
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
  set provider = p_provider,
      provider_ref = p_provider_ref,
      pending_plan_id = p_plan_id,
      pending_addon_module_key = p_addon_module_key,
      updated_at = now()
  where tenant_id = public.current_tenant_id();

  if not found then
    raise exception 'subscription not found';
  end if;
end;
$$;
revoke all on function public.set_subscription_checkout_ref(text, text, uuid, text) from public;
grant execute on function public.set_subscription_checkout_ref(text, text, uuid, text) to authenticated;

-- activate_subscription: ödeme onaylandıktan sonra, EĞER checkout bir modül
-- satın alma için başlatılmışsa (pending_addon_module_key dolu), modülü
-- doğrudan source='paid_addon' ile açar — set_tenant_module'ü ÇAĞIRMAZ,
-- çünkü o RPC is_platform_admin() ister ve bu akış (webhook, service_role)
-- bir platform admin oturumu değildir; upsert burada inline yapılır.
-- paid_addon kaynaklı olduğu için apply_plan_change bir daha asla bu satırı
-- işaretlemez (yalnızca source='plan' satırları düşürmede işaretlenir).
create or replace function public.activate_subscription(p_provider text, p_provider_ref text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_subscription record;
  v_target_plan_id uuid;
  v_target_module_key text;
begin
  select id, tenant_id, status, pending_plan_id, pending_addon_module_key into v_subscription
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

  if v_subscription.pending_addon_module_key is not null then
    v_target_module_key := v_subscription.pending_addon_module_key;
    update public.subscriptions set pending_addon_module_key = null where id = v_subscription.id;

    insert into public.tenant_modules (tenant_id, module_key, is_enabled, source)
    values (v_subscription.tenant_id, v_target_module_key, true, 'paid_addon')
    on conflict (tenant_id, module_key) do update set is_enabled = true, source = 'paid_addon', updated_at = now();
  end if;
end;
$$;
