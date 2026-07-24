-- Faz 9 Adım 1 (S39): delivery kanalı — bölgeler, bölge bazlı ücret/min
-- sepet, zamanlanmış sipariş.
--
-- Varsayım (kapsam sadeleştirmesi): ARCHITECTURE.md §4 customer_addresses'ı
-- (OTP ile doğrulanmış müşteriye bağlı kayıtlı adres defteri) planlıyor,
-- ama bunu bu adımda tam bağlamak (ayrı bir "önce telefon doğrula" akışı,
-- request_loyalty_otp'nin crm_loyalty'ye bağlı olmasından bağımsız yeni bir
-- OTP çifti) kapsamı ciddi büyütüyor. Faz 7 Adım 0'ın customer_segments'i
-- şema-only bıraktığı "şema kapısı" ilkesiyle aynı gerekçeyle:
-- customer_addresses burada şema-only açılır (RPC/UI yok), v1'de adres her
-- siparişte serbest metin olarak girilir ve siparişe SNAPSHOT'lanır (RULES
-- #18 zaten bunu gerektiriyor — adres sonradan değişse bile geçmiş sipariş
-- o anki adresi taşımalı). Kayıtlı adres defteri ileri bir adımda/fazda
-- customer_addresses'a bağlanabilir.

create table public.delivery_zones (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  name text not null,
  fee_minor integer not null default 0 check (fee_minor >= 0),
  min_basket_minor integer not null default 0 check (min_basket_minor >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index idx_delivery_zones_tenant_id on public.delivery_zones(tenant_id);
alter table public.delivery_zones enable row level security;
-- menu_categories ile aynı desen: misafir de aktif bölgeleri okuyabilmeli
-- (checkout'ta seçecek), is_staff() şartı yalnızca yazmada.
create policy "delivery_zones_select" on public.delivery_zones for select
  using (tenant_id = public.current_tenant_id());
create policy "delivery_zones_staff_write" on public.delivery_zones for all
  using (tenant_id = public.current_tenant_id() and public.is_staff())
  with check (tenant_id = public.current_tenant_id() and public.is_staff());
grant select, insert, update, delete on public.delivery_zones to authenticated;
grant all on public.delivery_zones to service_role;

create table public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  zone_id uuid references public.delivery_zones(id) on delete set null,
  label text,
  address_text text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create index idx_customer_addresses_tenant_id on public.customer_addresses(tenant_id);
alter table public.customer_addresses enable row level security;
create policy "customer_addresses_select" on public.customer_addresses for select
  using (tenant_id = public.current_tenant_id() and public.is_staff());
grant select on public.customer_addresses to authenticated;
grant all on public.customer_addresses to service_role;

-- orders: teslimat anlık görüntüsü — RULES #18 (adres/ücret sonradan
-- yeniden hesaplanmaz) + "zamanlanmış sipariş" (13:00'te hazır olsun).
-- v1'de zamanlanmış siparişler ayrı bir bekletme/tetikleme mekanizması
-- (yeni bir pg_cron job) OLMADAN, doğrudan orders'a normal şekilde düşer;
-- scheduled_for yalnızca personele "ne zaman hazır olmalı" bilgisini taşır
-- (KDS'te gösterim Adım kapsamında değil, personel taktir eder).
alter table public.orders add column delivery_zone_id uuid references public.delivery_zones(id) on delete set null;
alter table public.orders add column delivery_address_snapshot text;
alter table public.orders add column delivery_fee_minor integer not null default 0 check (delivery_fee_minor >= 0);
alter table public.orders add column scheduled_for timestamptz;

-- open_delivery_session: open_pickup_session'ın (0061) delivery karşılığı —
-- pickup_code üretmez, teslimat bilgisi checkout'ta (submit_order) verilir.
create or replace function public.open_delivery_session(p_tenant_id uuid)
returns uuid
language plpgsql
as $$
declare
  v_branch_id uuid;
  v_id uuid;
begin
  if not exists (
    select 1 from public.tenant_modules where tenant_id = p_tenant_id and module_key = 'delivery' and is_enabled = true
  ) then
    raise exception 'delivery module not enabled';
  end if;

  select id into v_branch_id from public.branches where tenant_id = p_tenant_id and is_default = true;
  if v_branch_id is null then
    raise exception 'invalid tenant';
  end if;

  insert into public.table_sessions (tenant_id, branch_id, table_id, channel)
  values (p_tenant_id, v_branch_id, null, 'delivery')
  returning id into v_id;

  insert into public.session_events (tenant_id, branch_id, table_session_id, event_type)
  values (p_tenant_id, v_branch_id, v_id, 'opened');

  return v_id;
end;
$$;
revoke all on function public.open_delivery_session(uuid) from public;
grant execute on function public.open_delivery_session(uuid) to service_role;

-- submit_order (0061) genişletmesi: yeni parametreler DEFAULT ile eklendiği
-- için eski 2 parametreli imza (0016/0061) önce DÜŞÜRÜLÜR — aksi halde
-- postgres iki farklı overload'u (2 param vs. default'lu 5 param) 2 argümanla
-- çağrıldığında AMBIGUOUS FUNCTION hatası verir (record_payment'ın 0049→0055
-- evriminde izlenen aynı desen). Delivery kanalında p_delivery_zone_id +
-- p_delivery_address zorunlu, min. sepet kontrolü toplam hesaplandıktan
-- sonra yapılır (STOCK_UNAVAILABLE ile aynı desen: 'MIN_BASKET_NOT_MET:%'),
-- ücret subtotal_minor'a eklenir ve ayrıca delivery_fee_minor'da saklanır
-- (Varsayım: subtotal_minor "borç toplamı" anlamına gelir — mevcut
-- payments/report kodu tek bir alanı toplayarak çalışmaya devam eder,
-- ücret ayrıca delivery_fee_minor'da şeffaf kalır).
drop function if exists public.submit_order(text, jsonb);

create or replace function public.submit_order(
  p_idempotency_key text, p_items jsonb,
  p_delivery_zone_id uuid default null, p_delivery_address text default null, p_scheduled_for timestamptz default null
)
returns table(order_id uuid, order_status text, subtotal_minor integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid := public.current_tenant_id();
  v_session_id uuid := public.current_table_session_id();
  v_branch_id uuid;
  v_channel text;
  v_device_id uuid;
  v_order_mode text;
  v_status text;
  v_order_id uuid;
  v_default_locale text;
  v_recent_count integer;
  v_item jsonb;
  v_extra_id jsonb;
  v_qty integer;
  v_product record;
  v_variant_id uuid;
  v_variant_price integer;
  v_variant_stock integer;
  v_variant_sold_out boolean;
  v_variant_active boolean;
  v_override_id uuid;
  v_override_price integer;
  v_override_available boolean;
  v_override_stock integer;
  v_override_sold_out boolean;
  v_effective_price integer;
  v_effective_sold_out boolean;
  v_effective_stock integer;
  v_line_subtotal integer;
  v_line_total integer := 0;
  v_product_name text;
  v_variant_name text;
  v_order_item_id uuid;
  v_extra record;
  v_extra_name text;
  v_delivery_fee integer := 0;
  v_min_basket integer;
begin
  if public.current_role() <> 'guest' or v_session_id is null then
    raise exception 'guest table session required';
  end if;

  return query
    select o.id, o.status, o.subtotal_minor
    from public.orders o
    where o.table_session_id = v_session_id and o.idempotency_key = p_idempotency_key;
  if found then
    return;
  end if;

  select branch_id, channel into v_branch_id, v_channel
  from public.table_sessions
  where id = v_session_id and status = 'active' and tenant_id = v_tenant_id
  for update;
  if not found then
    raise exception 'table session is not active';
  end if;

  if v_channel = 'delivery' then
    if p_delivery_zone_id is null or p_delivery_address is null or length(trim(p_delivery_address)) = 0 then
      raise exception 'delivery address and zone required';
    end if;
    select fee_minor, min_basket_minor into v_delivery_fee, v_min_basket
    from public.delivery_zones
    where id = p_delivery_zone_id and tenant_id = v_tenant_id and is_active = true;
    if not found then
      raise exception 'invalid delivery zone';
    end if;
  end if;

  select id into v_device_id
  from public.table_session_devices
  where guest_user_id = auth.uid() and table_session_id = v_session_id;

  select count(*) into v_recent_count
  from public.orders
  where table_session_id = v_session_id and created_at > now() - interval '60 seconds';
  if v_recent_count >= 5 then
    raise exception 'RATE_LIMITED';
  end if;

  select order_mode into v_order_mode from public.tenant_settings where tenant_id = v_tenant_id;
  v_status := case when v_order_mode = 'approval' then 'pending' else 'approved' end;

  select locale into v_default_locale
  from public.tenant_locales
  where tenant_id = v_tenant_id and is_default = true
  limit 1;

  if jsonb_array_length(p_items) = 0 then
    raise exception 'empty order';
  end if;

  insert into public.orders
    (tenant_id, branch_id, table_session_id, placed_by_device_id, channel, status, idempotency_key, subtotal_minor,
     delivery_zone_id, delivery_address_snapshot, scheduled_for)
  values (v_tenant_id, v_branch_id, v_session_id, v_device_id, v_channel, v_status, p_idempotency_key, 0,
     case when v_channel = 'delivery' then p_delivery_zone_id else null end,
     case when v_channel = 'delivery' then p_delivery_address else null end,
     p_scheduled_for)
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_qty := coalesce((v_item ->> 'quantity')::integer, 0);
    if v_qty <= 0 or v_qty > 20 then
      raise exception 'invalid quantity';
    end if;

    select id, base_price_minor, stock_quantity, is_sold_out, is_active, track_mode into v_product
    from public.products
    where id = (v_item ->> 'productId')::uuid and tenant_id = v_tenant_id
    for update;
    if not found or not v_product.is_active then
      raise exception 'STOCK_UNAVAILABLE:%', v_item ->> 'productId';
    end if;

    v_variant_id := null;
    v_variant_price := null;
    v_variant_stock := null;
    v_variant_sold_out := null;
    v_variant_active := null;

    if v_item ->> 'variantId' is not null then
      select id, price_minor, stock_quantity, is_sold_out, is_active
        into v_variant_id, v_variant_price, v_variant_stock, v_variant_sold_out, v_variant_active
      from public.product_variants
      where id = (v_item ->> 'variantId')::uuid and product_id = v_product.id
      for update;
      if v_variant_id is null or not v_variant_active then
        raise exception 'STOCK_UNAVAILABLE:%', v_item ->> 'variantId';
      end if;
    end if;

    v_override_id := null;
    v_override_price := null;
    v_override_available := null;
    v_override_stock := null;
    v_override_sold_out := null;

    select id, price_minor, is_available, stock_quantity, is_sold_out
      into v_override_id, v_override_price, v_override_available, v_override_stock, v_override_sold_out
    from public.branch_product_overrides
    where branch_id = v_branch_id
      and product_id = v_product.id
      and (
        (v_variant_id is not null and variant_id = v_variant_id)
        or (v_variant_id is null and variant_id is null)
      )
    for update;

    if coalesce(v_override_available, true) = false then
      raise exception 'STOCK_UNAVAILABLE:%', v_product.id;
    end if;

    v_effective_price := coalesce(v_override_price, v_variant_price, v_product.base_price_minor);
    v_effective_sold_out := coalesce(v_override_sold_out, v_variant_sold_out, v_product.is_sold_out, false);
    v_effective_stock := coalesce(v_override_stock, v_variant_stock, v_product.stock_quantity);

    if v_effective_sold_out then
      raise exception 'STOCK_UNAVAILABLE:%', v_product.id;
    end if;
    if v_effective_stock is not null and v_effective_stock < v_qty then
      raise exception 'STOCK_UNAVAILABLE:%', v_product.id;
    end if;

    if v_override_id is not null and v_override_stock is not null then
      update public.branch_product_overrides set stock_quantity = stock_quantity - v_qty where id = v_override_id;
    elsif v_variant_id is not null and v_variant_stock is not null then
      update public.product_variants set stock_quantity = stock_quantity - v_qty where id = v_variant_id;
    elsif v_variant_id is null and v_product.stock_quantity is not null then
      update public.products set stock_quantity = stock_quantity - v_qty where id = v_product.id;
    end if;

    if v_product.track_mode = 'recipe' then
      perform public.deduct_recipe_stock(v_tenant_id, v_branch_id, v_product.id, v_variant_id, v_qty, v_order_id);
    end if;

    select value into v_product_name from public.content_translations
    where tenant_id = v_tenant_id and entity_type = 'product' and entity_id = v_product.id
      and locale = v_default_locale and field = 'name';
    v_variant_name := null;
    if v_variant_id is not null then
      select value into v_variant_name from public.content_translations
      where tenant_id = v_tenant_id and entity_type = 'product_variant' and entity_id = v_variant_id
        and locale = v_default_locale and field = 'name';
    end if;

    v_line_subtotal := v_effective_price * v_qty;

    insert into public.order_items
      (tenant_id, branch_id, table_session_id, order_id, product_id, variant_id,
       product_name_snapshot, variant_name_snapshot, unit_price_minor, quantity, line_subtotal_minor)
    values
      (v_tenant_id, v_branch_id, v_session_id, v_order_id, v_product.id, v_variant_id,
       coalesce(v_product_name, ''), v_variant_name, v_effective_price, v_qty, v_line_subtotal)
    returning id into v_order_item_id;

    v_line_total := v_line_total + v_line_subtotal;

    if v_item ? 'extraIds' then
      for v_extra_id in select * from jsonb_array_elements(v_item -> 'extraIds')
      loop
        select id, price_minor, is_sold_out, stock_quantity, is_active into v_extra
        from public.product_extras
        where id = (v_extra_id #>> '{}')::uuid and product_id = v_product.id
        for update;
        if not found or not v_extra.is_active then
          raise exception 'STOCK_UNAVAILABLE:%', v_extra_id #>> '{}';
        end if;
        if v_extra.is_sold_out or (v_extra.stock_quantity is not null and v_extra.stock_quantity < 1) then
          raise exception 'STOCK_UNAVAILABLE:%', v_extra_id #>> '{}';
        end if;

        if v_extra.stock_quantity is not null then
          update public.product_extras set stock_quantity = stock_quantity - 1 where id = v_extra.id;
        end if;

        select value into v_extra_name from public.content_translations
        where tenant_id = v_tenant_id and entity_type = 'product_extra' and entity_id = v_extra.id
          and locale = v_default_locale and field = 'name';

        insert into public.order_item_extras
          (tenant_id, branch_id, table_session_id, order_item_id, extra_id, extra_name_snapshot, unit_price_minor)
        values
          (v_tenant_id, v_branch_id, v_session_id, v_order_item_id, v_extra.id, coalesce(v_extra_name, ''), v_extra.price_minor);

        v_line_total := v_line_total + v_extra.price_minor;
      end loop;
    end if;
  end loop;

  if v_channel = 'delivery' and v_line_total < v_min_basket then
    raise exception 'MIN_BASKET_NOT_MET:%', v_min_basket;
  end if;

  update public.orders
  set subtotal_minor = v_line_total + v_delivery_fee, delivery_fee_minor = v_delivery_fee, updated_at = now()
  where id = v_order_id;
  update public.table_sessions set last_activity_at = now() where id = v_session_id;

  return query select v_order_id, v_status, v_line_total + v_delivery_fee;
end;
$$;

revoke all on function public.submit_order(text, jsonb, uuid, text, timestamptz) from public;
grant execute on function public.submit_order(text, jsonb, uuid, text, timestamptz) to authenticated;
