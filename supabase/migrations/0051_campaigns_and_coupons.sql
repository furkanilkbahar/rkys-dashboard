-- Faz 6 Adım 2: Pricing Rules motoru v1 + kural bazlı kampanya/kupon (S27).
-- v1 kapsamı (kullanıcı onaylı, PLAN.md'nin 4 kalemiyle sınırlı): 4 kural
-- tipi (bogo, saat aralığı, kategori indirimi, yüzde indirim) + kupon kodu +
-- kullanım limiti. Tam "pricing rules editörü" ileri bir faza bırakıldı.
-- İndirim mevcut comps ledger'ına (reason_codes.category='campaign') yazılır
-- — yeni bir paralel indirim tablosu icat edilmez, RULES #18/#35 ile tutarlı.

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  rule_type text not null check (rule_type in ('bogo', 'time_window', 'category_discount', 'percentage_off')),
  rule_config jsonb not null default '{}'::jsonb,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_campaigns_tenant_id on public.campaigns(tenant_id);
alter table public.campaigns enable row level security;
create policy "campaigns_select" on public.campaigns for select
  using (tenant_id = public.current_tenant_id() and public.is_staff());
create policy "campaigns_staff_write" on public.campaigns for all
  using (tenant_id = public.current_tenant_id() and public.is_staff())
  with check (tenant_id = public.current_tenant_id() and public.is_staff());
grant select, insert, update, delete on public.campaigns to authenticated, service_role;

create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  code text not null,
  usage_limit integer,
  used_count integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id, code)
);
create index idx_coupons_tenant_id on public.coupons(tenant_id);
alter table public.coupons enable row level security;
-- Misafir kupon kodunu doğrudan kupon adına göre değil apply_coupon_to_order
-- RPC'si üzerinden uygular (kod bilgisi RLS'e ihtiyaç duymaz) — select/write
-- yalnızca staff'a açık, coupons tablosu misafire hiç görünmez.
create policy "coupons_select" on public.coupons for select
  using (tenant_id = public.current_tenant_id() and public.is_staff());
create policy "coupons_staff_write" on public.coupons for all
  using (tenant_id = public.current_tenant_id() and public.is_staff())
  with check (tenant_id = public.current_tenant_id() and public.is_staff());
grant select, insert, update, delete on public.coupons to authenticated, service_role;

create table public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  coupon_id uuid not null references public.coupons(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  comp_id uuid references public.comps(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (coupon_id, order_id)
);
create index idx_coupon_redemptions_tenant_id on public.coupon_redemptions(tenant_id);
alter table public.coupon_redemptions enable row level security;
create policy "coupon_redemptions_select" on public.coupon_redemptions for select
  using (tenant_id = public.current_tenant_id() and public.is_staff());
grant select on public.coupon_redemptions to authenticated;
grant select, insert, update, delete on public.coupon_redemptions to service_role;

-- tenant_modules RLS 0007'den beri staff-only (is_staff() şartlı) — bu doğru
-- (modül konfigürasyonu personel bilgisi), ama misafirin KENDİ tenant'ında bir
-- modülün açık olup olmadığını sorabilmesi lazım (ör. sepette kupon alanının
-- görünmesi). is_tenant_active (0037) ile aynı desen: tek bit dönen minimal
-- SECURITY DEFINER RPC, tenant_modules'ı hiç genişletmeden.
create or replace function public.is_module_enabled(p_tenant_id uuid, p_module_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select is_enabled from public.tenant_modules where tenant_id = p_tenant_id and module_key = p_module_key),
    false
  )
$$;
grant execute on function public.is_module_enabled(uuid, text) to authenticated;

alter table public.reason_codes drop constraint reason_codes_category_check;
alter table public.reason_codes add constraint reason_codes_category_check
  check (category in ('comp', 'refund', 'cancel', 'campaign'));

-- Her tenant için sabit bir "campaign" sebep kodu (apply_coupon_to_order'ın
-- comps'a yazarken kullandığı well-known anahtar) — misafirin kupon
-- uygulayabilmesi personelin önceden bir sebep kodu oluşturmasına bağlı
-- olmamalı. Yeni tenant'larda trigger, mevcut tenant'larda tek seferlik insert.
create or replace function public.create_default_campaign_reason_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.reason_codes (tenant_id, category, key, display_order)
  values (new.id, 'campaign', 'coupon_discount', 0);
  return new;
end;
$$;

create trigger trg_tenants_create_campaign_reason_code
after insert on public.tenants
for each row execute function public.create_default_campaign_reason_code();

insert into public.reason_codes (tenant_id, category, key, display_order)
select id, 'campaign', 'coupon_discount', 0 from public.tenants
on conflict (tenant_id, category, key) do nothing;

-- apply_coupon_to_order: misafir (kendi oturumunun siparişine) veya personel
-- (herhangi bir siparişe) çağırabilir — current_can() izin kapısı değil,
-- kuponun KENDİ geçerliliği (aktif/süre/limit) doğrulanır. İndirim comps'a
-- (mevcut ikram ledger'ı) yazılır; kümülatif comp siparişin subtotal'ını
-- record_comp ile aynı şekilde aşamaz.
create or replace function public.apply_coupon_to_order(p_order_id uuid, p_code text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid := public.current_tenant_id();
  v_branch_id uuid;
  v_table_session_id uuid;
  v_subtotal integer;
  v_status text;
  v_already_comped integer;
  v_coupon record;
  v_campaign record;
  v_timezone text;
  v_discount integer;
  v_reason_code_id uuid;
  v_comp_id uuid;
  v_created_by uuid;
begin
  select branch_id, table_session_id, subtotal_minor, status
  into v_branch_id, v_table_session_id, v_subtotal, v_status
  from public.orders
  where id = p_order_id and tenant_id = v_tenant_id
  for update;
  if not found or v_status = 'cancelled' then
    raise exception 'order not eligible';
  end if;

  if public.current_role() = 'guest' and v_table_session_id is distinct from public.current_table_session_id() then
    raise exception 'forbidden';
  end if;

  -- Modül kapalıysa yalnızca UI/route'ta değil, burada da reddedilir
  -- (RULES #34'ün ruhu — para etkileyen bir RPC'nin modül kapalıyken hâlâ
  -- doğrudan çağrılabilir olması yeterli değildir).
  if not exists (
    select 1 from public.tenant_modules
    where tenant_id = v_tenant_id and module_key = 'campaigns' and is_enabled = true
  ) then
    raise exception 'campaigns module not enabled';
  end if;

  select * into v_coupon from public.coupons
  where tenant_id = v_tenant_id and code = p_code and is_active = true
  for update;
  if not found then
    raise exception 'invalid coupon code';
  end if;
  if v_coupon.usage_limit is not null and v_coupon.used_count >= v_coupon.usage_limit then
    raise exception 'coupon usage limit reached';
  end if;
  if exists (select 1 from public.coupon_redemptions where coupon_id = v_coupon.id and order_id = p_order_id) then
    raise exception 'coupon already applied to this order';
  end if;

  select * into v_campaign from public.campaigns where id = v_coupon.campaign_id and is_active = true;
  if not found then
    raise exception 'campaign not active';
  end if;
  if v_campaign.starts_at is not null and now() < v_campaign.starts_at then
    raise exception 'campaign not started';
  end if;
  if v_campaign.ends_at is not null and now() > v_campaign.ends_at then
    raise exception 'campaign ended';
  end if;

  select timezone into v_timezone from public.tenants where id = v_tenant_id;

  v_discount := case v_campaign.rule_type
    when 'percentage_off' then
      (v_subtotal * coalesce((v_campaign.rule_config->>'percentage')::integer, 0)) / 100
    when 'bogo' then (
      select coalesce(min(oi.unit_price_minor), 0)
      from public.order_items oi
      where oi.order_id = p_order_id and oi.product_id = (v_campaign.rule_config->>'productId')::uuid
      having sum(oi.quantity) >= 2
    )
    when 'category_discount' then (
      select coalesce(sum(oi.line_subtotal_minor), 0) * coalesce((v_campaign.rule_config->>'percentage')::integer, 0) / 100
      from public.order_items oi
      join public.products pr on pr.id = oi.product_id
      where oi.order_id = p_order_id and pr.category_id = (v_campaign.rule_config->>'categoryId')::uuid
    )
    when 'time_window' then (
      case when extract(hour from now() at time zone coalesce(v_timezone, 'UTC'))
        between coalesce((v_campaign.rule_config->>'startHour')::integer, 0) and coalesce((v_campaign.rule_config->>'endHour')::integer, 23)
      then (v_subtotal * coalesce((v_campaign.rule_config->>'percentage')::integer, 0)) / 100
      else 0 end
    )
    else 0
  end;

  if v_discount is null or v_discount <= 0 then
    raise exception 'coupon not applicable to this order';
  end if;

  select coalesce(sum(amount_minor), 0) into v_already_comped from public.comps where order_id = p_order_id;
  if v_discount > v_subtotal - v_already_comped then
    v_discount := v_subtotal - v_already_comped;
  end if;
  if v_discount <= 0 then
    raise exception 'order already fully comped';
  end if;

  select id into v_reason_code_id from public.reason_codes
  where tenant_id = v_tenant_id and category = 'campaign' and key = 'coupon_discount';

  -- comps.created_by profiles'a referans verir — misafirin profiles satırı
  -- yok, bu yüzden yalnızca personel çağrısında dolu.
  v_created_by := case when public.is_staff() then auth.uid() else null end;

  insert into public.comps (tenant_id, branch_id, order_id, amount_minor, reason_code_id, note, created_by)
  values (v_tenant_id, v_branch_id, p_order_id, v_discount, v_reason_code_id, 'coupon:' || p_code, v_created_by)
  returning id into v_comp_id;

  insert into public.coupon_redemptions (tenant_id, coupon_id, order_id, comp_id)
  values (v_tenant_id, v_coupon.id, p_order_id, v_comp_id);

  update public.coupons set used_count = used_count + 1 where id = v_coupon.id;

  return v_discount;
end;
$$;
revoke all on function public.apply_coupon_to_order(uuid, text) from public;
grant execute on function public.apply_coupon_to_order(uuid, text) to authenticated;
