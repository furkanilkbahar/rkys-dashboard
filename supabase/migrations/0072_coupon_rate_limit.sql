-- Düşük öncelikli bulgu (kullanıcı onayıyla ele alındı): apply_coupon_to_order
-- (0051) misafirin gönderdiği kupon kodunu hiçbir gecikme/sınır olmadan
-- aratıyordu — kısa/tahmin edilebilir kodlar (ör. "YAZ2026") kaba kuvvetle
-- (brute-force) denenebilirdi.
--
-- Not: Kalıcı bir "deneme sayacı" (staff_devices.failed_pin_attempts gibi)
-- burada İŞE YARAMAZ — bu fonksiyon 'invalid coupon code' hatası
-- fırlattığında (ki brute-force'un asıl senaryosu tam olarak budur),
-- Postgres o ÇAĞRININ İÇİNDE yapılan TÜM yazmaları (sayaç artırma dahil)
-- otomatik olarak geri alır (fonksiyon exception ile bitince transaction
-- rollback olur — ayrı bir RPC round-trip'i olmadan bu sayaç asla ilerlemez,
-- doğrulandı). Bu yüzden burada kalıcı sayaç yerine, misafir tarafında
-- geçersiz kod denemesine sabit bir gecikme eklenir (pg_sleep) — şema
-- değişikliği/transaction karmaşıklığı gerektirmeyen, login/OTP uçlarında
-- yaygın kullanılan basit bir kaba-kuvvet yavaşlatma yöntemi.
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
  v_is_guest boolean;
begin
  select branch_id, table_session_id, subtotal_minor, status
  into v_branch_id, v_table_session_id, v_subtotal, v_status
  from public.orders
  where id = p_order_id and tenant_id = v_tenant_id
  for update;
  if not found or v_status = 'cancelled' then
    raise exception 'order not eligible';
  end if;

  v_is_guest := public.current_role() = 'guest';
  if v_is_guest and v_table_session_id is distinct from public.current_table_session_id() then
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
    if v_is_guest then
      perform pg_sleep(1);
    end if;
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
