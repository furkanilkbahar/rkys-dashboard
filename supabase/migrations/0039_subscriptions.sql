-- Faz 4 Adım 3: trial + abonelik (mock-first, S13, D18).

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null unique references public.tenants(id) on delete cascade,
  status text not null default 'trialing' check (status in ('trialing', 'active', 'past_due', 'canceled')),
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  provider text check (provider in ('mock', 'iyzico')),
  provider_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Webhook idempotency'si (complete_online_payment, 0032, ile aynı desen).
create unique index idx_subscriptions_provider_ref
  on public.subscriptions (provider, provider_ref) where provider_ref is not null;

alter table public.subscriptions enable row level security;

create policy "subscriptions_select_own"
  on public.subscriptions for select
  using (tenant_id = public.current_tenant_id() and public.is_staff());

create policy "subscriptions_platform_admin_all"
  on public.subscriptions for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

grant select on public.subscriptions to authenticated, service_role;
grant insert, update, delete on public.subscriptions to service_role;

-- Her yeni tenant otomatik 14 günlük kartsız trial'la başlar (D18) —
-- tenant_settings/rating_settings/counter-masa auto-create trigger'larıyla
-- aynı desen (0008/0027/0029).
create or replace function public.create_default_subscription()
returns trigger
language plpgsql
as $$
begin
  insert into public.subscriptions (tenant_id, status, trial_ends_at)
  values (new.id, 'trialing', now() + interval '14 days');
  return new;
end;
$$;

create trigger trg_tenants_create_subscription
  after insert on public.tenants
  for each row execute function public.create_default_subscription();

-- Backfill: mevcut tenant'lar (acme/beta/gamma) da trial_ends_at gelecekte
-- kalacak şekilde satır alır — hiçbir mevcut testi/akışı kısıtlamaz.
insert into public.subscriptions (tenant_id, status, trial_ends_at)
select t.id, 'trialing', now() + interval '14 days'
from public.tenants t
where not exists (select 1 from public.subscriptions s where s.tenant_id = t.id);

create or replace function public.is_subscription_active(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select status = 'active' or (status = 'trialing' and trial_ends_at > now())
      from public.subscriptions
      where tenant_id = p_tenant_id
    ),
    false
  )
$$;
grant execute on function public.is_subscription_active(uuid) to authenticated;

-- Checkout başlatılırken sağlayıcı referansı kaydedilir; webhook geldiğinde
-- bu referansla satır bulunup 'active'e çevrilir (complete_online_payment,
-- 0032, ile aynı desen).
create or replace function public.set_subscription_checkout_ref(p_provider text, p_provider_ref text)
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
  set provider = p_provider, provider_ref = p_provider_ref, updated_at = now()
  where tenant_id = public.current_tenant_id();

  if not found then
    raise exception 'subscription not found';
  end if;
end;
$$;
revoke all on function public.set_subscription_checkout_ref(text, text) from public;
grant execute on function public.set_subscription_checkout_ref(text, text) to authenticated;

-- Yalnızca webhook route handler'ı (service_role) çağırır — complete_online_payment
-- (0032) ile aynı gerekçe: route kimliksiz, sağlayıcı çağırıyor.
create or replace function public.activate_subscription(p_provider text, p_provider_ref text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_subscription record;
begin
  select id, status into v_subscription
  from public.subscriptions
  where provider = p_provider and provider_ref = p_provider_ref
  for update;

  if not found then
    raise exception 'unknown subscription checkout';
  end if;

  if v_subscription.status = 'active' then
    return; -- idempotent: zaten aktif
  end if;

  update public.subscriptions
  set status = 'active', current_period_end = now() + interval '30 days', updated_at = now()
  where id = v_subscription.id;
end;
$$;
revoke all on function public.activate_subscription(text, text) from public;
grant execute on function public.activate_subscription(text, text) to service_role;

create or replace function public.cancel_subscription()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_role() <> 'owner' then
    raise exception 'owner only';
  end if;

  update public.subscriptions
  set status = 'canceled', updated_at = now()
  where tenant_id = public.current_tenant_id();
end;
$$;
revoke all on function public.cancel_subscription() from public;
grant execute on function public.cancel_subscription() to authenticated;
