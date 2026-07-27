-- Güvenlik taraması düzeltmeleri (/code-review ultra, Faz 1-11 kapanışı
-- sonrası) — Kritik ve Orta düzey bulgular. Her bölüm ayrı bir bulguya
-- karşılık gelir, yorum satırları hangi bulguyu kapattığını belirtir.

-- === KRİTİK: deduct_recipe_stock guest'ten çağrılabiliyordu, recipe
-- lookup'ları tenant filtresizdi (RULES #2). Tek meşru çağıran submit_order/
-- submit_staff_order/ingest_marketplace_order zaten security definer —
-- authenticated grant'i kaldırmak bu iç çağrıları etkilemez (sahiplik
-- fonksiyonun OWNER'ından gelir, çağıranın grant'inden değil).
create or replace function public.deduct_recipe_stock(
  p_tenant_id uuid, p_branch_id uuid, p_product_id uuid, p_variant_id uuid,
  p_quantity integer, p_order_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recipe_id uuid;
  v_item record;
  v_delta numeric;
begin
  if not exists (
    select 1 from public.tenant_modules
    where tenant_id = p_tenant_id and module_key = 'recipes' and is_enabled = true
  ) then
    return;
  end if;

  v_recipe_id := null;
  if p_variant_id is not null then
    select id into v_recipe_id from public.recipes
    where product_id = p_product_id and variant_id = p_variant_id and tenant_id = p_tenant_id;
  end if;
  if v_recipe_id is null then
    select id into v_recipe_id from public.recipes
    where product_id = p_product_id and variant_id is null and tenant_id = p_tenant_id;
  end if;
  if v_recipe_id is null then
    return;
  end if;

  for v_item in
    select ingredient_id, quantity_per_unit from public.recipe_items where recipe_id = v_recipe_id
  loop
    v_delta := -1 * v_item.quantity_per_unit * p_quantity;

    update public.ingredients
    set current_stock = current_stock + v_delta, updated_at = now()
    where id = v_item.ingredient_id and tenant_id = p_tenant_id;

    insert into public.stock_movements
      (tenant_id, branch_id, ingredient_id, type, quantity_delta, unit_cost_minor_snapshot, order_id)
    select p_tenant_id, p_branch_id, v_item.ingredient_id, 'sale_deduction', v_delta, avg_cost_minor_per_unit, p_order_id
    from public.ingredients where id = v_item.ingredient_id;
  end loop;
end;
$$;
revoke all on function public.deduct_recipe_stock(uuid, uuid, uuid, uuid, integer, uuid) from public, authenticated;
grant execute on function public.deduct_recipe_stock(uuid, uuid, uuid, uuid, integer, uuid) to service_role;

-- === KRİTİK: recompute_product_cost herhangi bir authenticated kullanıcı
-- (misafir dahil) tarafından, hiçbir tenant/staff kontrolü olmadan
-- çağrılabiliyordu; başka bir tenant'ın product_id'siyle çağrılırsa o
-- tenant'ın maliyet verisini okuyup product_costs'a yazabiliyordu.
create or replace function public.recompute_product_cost(p_product_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_recipe_id uuid;
  v_cost_minor integer;
begin
  if not public.is_staff() then
    raise exception 'staff only';
  end if;

  select tenant_id into v_tenant_id from public.products
  where id = p_product_id and tenant_id = public.current_tenant_id();
  if v_tenant_id is null then
    return;
  end if;

  select id into v_recipe_id from public.recipes where product_id = p_product_id and variant_id is null and tenant_id = v_tenant_id;
  if v_recipe_id is null then
    return;
  end if;

  select round(coalesce(sum(ri.quantity_per_unit * i.avg_cost_minor_per_unit), 0))::integer into v_cost_minor
  from public.recipe_items ri
  join public.ingredients i on i.id = ri.ingredient_id
  where ri.recipe_id = v_recipe_id;

  insert into public.product_costs (product_id, tenant_id, cost_minor)
  values (p_product_id, v_tenant_id, v_cost_minor)
  on conflict (product_id) do update set cost_minor = excluded.cost_minor, updated_at = now();
end;
$$;
revoke all on function public.recompute_product_cost(uuid) from public;
grant execute on function public.recompute_product_cost(uuid) to authenticated, service_role;

-- recompute_costs_for_ingredient: yalnızca record_purchase (aynı migration
-- dosyasındaki security definer fonksiyon) içinden perform ile çağrılıyor,
-- hiçbir client kodu doğrudan çağırmıyor — authenticated grant'i gereksiz
-- saldırı yüzeyi.
revoke all on function public.recompute_costs_for_ingredient(uuid) from public, authenticated;
grant execute on function public.recompute_costs_for_ingredient(uuid) to service_role;

-- === KRİTİK: advance_courier_assignment sahiplik kontrolü yapmıyordu —
-- herhangi bir kurye BAŞKA bir kuryenin atamasını ilerletebiliyordu.
-- Kurye modülü kapısı da hiçbir kurye RPC'sinde yoktu (assign_courier,
-- advance_courier_assignment, get_courier_daily_summary).
create or replace function public.assign_courier(p_order_id uuid, p_courier_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid := public.current_tenant_id();
  v_branch_id uuid;
  v_channel text;
  v_courier_role text;
  v_assignment_id uuid;
  v_existing_status text;
begin
  if not public.is_staff() then
    raise exception 'staff only';
  end if;
  if not exists (
    select 1 from public.tenant_modules where tenant_id = v_tenant_id and module_key = 'courier' and is_enabled = true
  ) then
    raise exception 'courier module not enabled';
  end if;

  select branch_id, channel into v_branch_id, v_channel
  from public.orders where id = p_order_id and tenant_id = v_tenant_id;
  if v_branch_id is null then
    raise exception 'order not found';
  end if;
  if v_channel <> 'delivery' then
    raise exception 'order is not a delivery order';
  end if;

  select role into v_courier_role from public.profiles where id = p_courier_id and tenant_id = v_tenant_id;
  if v_courier_role is distinct from 'courier' then
    raise exception 'invalid courier';
  end if;

  select id, status into v_assignment_id, v_existing_status from public.courier_assignments where order_id = p_order_id for update;
  if v_existing_status = 'delivered' then
    raise exception 'order already delivered';
  end if;

  if v_assignment_id is null then
    insert into public.courier_assignments (tenant_id, branch_id, order_id, courier_id)
    values (v_tenant_id, v_branch_id, p_order_id, p_courier_id)
    returning id into v_assignment_id;
  else
    update public.courier_assignments set courier_id = p_courier_id where id = v_assignment_id;
  end if;

  return v_assignment_id;
end;
$$;
revoke all on function public.assign_courier(uuid, uuid) from public;
grant execute on function public.assign_courier(uuid, uuid) to authenticated;

create or replace function public.advance_courier_assignment(p_assignment_id uuid, p_to_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid := public.current_tenant_id();
  v_status text;
  v_courier_id uuid;
  v_legal_next text;
begin
  if not public.is_staff() then
    raise exception 'staff only';
  end if;
  if not exists (
    select 1 from public.tenant_modules where tenant_id = v_tenant_id and module_key = 'courier' and is_enabled = true
  ) then
    raise exception 'courier module not enabled';
  end if;

  select status, courier_id into v_status, v_courier_id from public.courier_assignments
  where id = p_assignment_id and tenant_id = v_tenant_id
  for update;
  if not found then
    raise exception 'assignment not found';
  end if;

  -- Yalnızca atanmış kurye kendi teslimatını ilerletebilir; owner/manager
  -- her zaman muaf (RULES #41 ruhu: yönetici müdahalesi engellenmez).
  if public.current_role() not in ('owner', 'manager') and v_courier_id <> auth.uid() then
    raise exception 'PERMISSION_DENIED:courier_assignment.advance';
  end if;

  v_legal_next := case v_status
    when 'assigned' then 'en_route'
    when 'en_route' then 'delivered'
    else null
  end;
  if v_legal_next is null or p_to_status <> v_legal_next then
    raise exception 'ILLEGAL_TRANSITION:% -> %', v_status, p_to_status;
  end if;

  update public.courier_assignments
  set status = p_to_status,
      en_route_at = case when p_to_status = 'en_route' then now() else en_route_at end,
      delivered_at = case when p_to_status = 'delivered' then now() else delivered_at end
  where id = p_assignment_id;
end;
$$;
revoke all on function public.advance_courier_assignment(uuid, text) from public;
grant execute on function public.advance_courier_assignment(uuid, text) to authenticated;

create or replace function public.get_courier_daily_summary(p_courier_id uuid, p_business_date date)
returns table(delivered_count integer, total_amount_minor integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid := public.current_tenant_id();
  v_timezone text;
begin
  if not public.is_staff() then
    raise exception 'staff only';
  end if;
  if not exists (
    select 1 from public.tenant_modules where tenant_id = v_tenant_id and module_key = 'courier' and is_enabled = true
  ) then
    raise exception 'courier module not enabled';
  end if;
  select timezone into v_timezone from public.tenants where id = v_tenant_id;

  return query
  select count(*)::integer, coalesce(sum(o.subtotal_minor), 0)::integer
  from public.courier_assignments ca
  join public.orders o on o.id = ca.order_id
  where ca.tenant_id = v_tenant_id and ca.courier_id = p_courier_id and ca.status = 'delivered'
    and (ca.delivered_at at time zone coalesce(v_timezone, 'UTC'))::date = p_business_date;
end;
$$;
revoke all on function public.get_courier_daily_summary(uuid, date) from public;
grant execute on function public.get_courier_daily_summary(uuid, date) to authenticated;

-- === ORTA: delivery_zones sorgusu branch_id ile kısıtlı değildi — Branch
-- B'deki bir misafir Branch A'ya ait bir bölge kimliğini (id tahmin edilir/
-- bilinirse) kullanarak o bölgenin ücret/min. sepetini uygulayabiliyordu.
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
    where id = p_delivery_zone_id and tenant_id = v_tenant_id and branch_id = v_branch_id and is_active = true;
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

-- === ORTA: order.created webhook payload'ı subtotal_minor'ı HER ZAMAN 0
-- gösteriyordu — tüm sipariş oluşturma RPC'leri orders satırını
-- subtotal_minor=0 ile INSERT edip kalemler işlendikten SONRA UPDATE
-- ediyor; eski trigger yalnızca INSERT anındaki (her zaman 0) değeri
-- kullanıyordu ve status değişmeyen fixup UPDATE'i webhook tetiklemiyordu.
-- Çözüm: trigger'ı DEFERRABLE INITIALLY DEFERRED yapıp commit anında
-- satırı YENİDEN OKUMAK — aynı transaction içindeki subtotal fixup
-- UPDATE'i bu noktada zaten uygulanmış olur.
drop trigger if exists trg_orders_webhook_events on public.orders;

create or replace function public.trg_enqueue_order_webhook()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_final_subtotal integer;
begin
  if TG_OP = 'INSERT' then
    select subtotal_minor into v_final_subtotal from public.orders where id = new.id;
    perform public.enqueue_webhook_event(
      new.tenant_id, 'order.created',
      jsonb_build_object('order_id', new.id, 'channel', new.channel, 'status', new.status, 'subtotal_minor', coalesce(v_final_subtotal, new.subtotal_minor))
    );
  elsif TG_OP = 'UPDATE' and new.status is distinct from old.status then
    perform public.enqueue_webhook_event(
      new.tenant_id, 'order.status_changed',
      jsonb_build_object('order_id', new.id, 'channel', new.channel, 'status', new.status, 'previous_status', old.status)
    );
  end if;
  return new;
end;
$$;

create constraint trigger trg_orders_webhook_events
after insert or update on public.orders
deferrable initially deferred
for each row execute function public.trg_enqueue_order_webhook();

-- === ORTA: ingest_marketplace_order rate limiting'e sahip değildi
-- (RULES #8), birim fiyat için pozitif değer doğrulaması yoktu, ve
-- external_order_id idempotency kontrolü ile INSERT arasında bir TOCTOU
-- penceresi vardı (eşzamanlı iki retry, unique index ihlaliyle YAKALANMAMIŞ
-- bir hataya düşebiliyordu).
create or replace function public.ingest_marketplace_order(
  p_tenant_id uuid,
  p_provider text,
  p_external_order_id text,
  p_items jsonb
)
returns table(order_id uuid, is_duplicate boolean)
language plpgsql
set search_path = public
as $$
declare
  v_branch_id uuid;
  v_session_id uuid;
  v_order_id uuid;
  v_existing_order_id uuid;
  v_item jsonb;
  v_qty integer;
  v_unit_price integer;
  v_product_id uuid;
  v_track_mode text;
  v_stock_quantity integer;
  v_line_total integer := 0;
  v_recent_count integer;
begin
  if not exists (
    select 1 from public.tenant_modules
    where tenant_id = p_tenant_id and module_key = 'marketplace' and is_enabled = true
  ) then
    raise exception 'marketplace module not enabled';
  end if;

  select o.id into v_existing_order_id
  from public.table_sessions ts
  join public.orders o on o.table_session_id = ts.id
  where ts.tenant_id = p_tenant_id and ts.external_provider = p_provider and ts.external_order_id = p_external_order_id;
  if found then
    return query select v_existing_order_id, true;
    return;
  end if;

  select count(*) into v_recent_count
  from public.table_sessions
  where tenant_id = p_tenant_id and external_provider = p_provider and created_at > now() - interval '60 seconds';
  if v_recent_count >= 20 then
    raise exception 'RATE_LIMITED';
  end if;

  select id into v_branch_id from public.branches where tenant_id = p_tenant_id and is_default = true;
  if v_branch_id is null then
    raise exception 'invalid tenant';
  end if;

  if jsonb_array_length(p_items) = 0 then
    raise exception 'empty order';
  end if;

  begin
    insert into public.table_sessions (tenant_id, branch_id, table_id, channel, external_provider, external_order_id)
    values (p_tenant_id, v_branch_id, null, 'marketplace', p_provider, p_external_order_id)
    returning id into v_session_id;
  exception when unique_violation then
    -- Eşzamanlı retry: başka bir istek aynı external_order_id'yi bu sırada
    -- commit etti — TOCTOU penceresini kapat, hata fırlatmak yerine o
    -- siparişi idempotent şekilde döndür.
    select o.id into v_existing_order_id
    from public.table_sessions ts
    join public.orders o on o.table_session_id = ts.id
    where ts.tenant_id = p_tenant_id and ts.external_provider = p_provider and ts.external_order_id = p_external_order_id;
    return query select v_existing_order_id, true;
    return;
  end;

  insert into public.session_events (tenant_id, branch_id, table_session_id, event_type)
  values (p_tenant_id, v_branch_id, v_session_id, 'opened');

  insert into public.orders
    (tenant_id, branch_id, table_session_id, channel, status, idempotency_key, subtotal_minor)
  values (p_tenant_id, v_branch_id, v_session_id, 'marketplace', 'approved', p_provider || ':' || p_external_order_id, 0)
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_qty := coalesce((v_item ->> 'quantity')::integer, 0);
    if v_qty <= 0 then
      raise exception 'invalid quantity';
    end if;
    v_unit_price := coalesce((v_item ->> 'unitPriceMinor')::integer, -1);
    if v_unit_price < 0 then
      raise exception 'invalid unit price';
    end if;

    select product_id into v_product_id
    from public.product_external_mappings
    where tenant_id = p_tenant_id and provider = p_provider and external_sku = (v_item ->> 'externalSku');
    if v_product_id is null then
      raise exception 'SKU_NOT_MAPPED:%', v_item ->> 'externalSku';
    end if;

    select track_mode, stock_quantity into v_track_mode, v_stock_quantity
    from public.products where id = v_product_id and tenant_id = p_tenant_id
    for update;

    if v_stock_quantity is not null then
      update public.products set stock_quantity = stock_quantity - v_qty where id = v_product_id;
    end if;
    if v_track_mode = 'recipe' then
      perform public.deduct_recipe_stock(p_tenant_id, v_branch_id, v_product_id, null::uuid, v_qty, v_order_id);
    end if;

    insert into public.order_items
      (tenant_id, branch_id, table_session_id, order_id, product_id, variant_id,
       product_name_snapshot, variant_name_snapshot, unit_price_minor, quantity, line_subtotal_minor)
    values
      (p_tenant_id, v_branch_id, v_session_id, v_order_id, v_product_id, null,
       coalesce(v_item ->> 'name', ''), null, v_unit_price, v_qty, v_unit_price * v_qty);

    v_line_total := v_line_total + v_unit_price * v_qty;
  end loop;

  update public.orders set subtotal_minor = v_line_total where id = v_order_id;

  return query select v_order_id, false;
end;
$$;
revoke all on function public.ingest_marketplace_order(uuid, text, text, jsonb) from public;
grant execute on function public.ingest_marketplace_order(uuid, text, text, jsonb) to service_role;

-- === KRİTİK: vardıya PIN'i (clock_in_or_out) brute-force korumasızdı —
-- 4-8 haneli bir PIN'in tüm uzayı (10^4-10^8) hız sınırı olmadan
-- denenebiliyordu. Cihaz başına art arda 5 hatalı denemeden sonra 5 dakika
-- kilitleniyor (RULES #8 ruhu).
alter table public.staff_devices add column if not exists failed_pin_attempts integer not null default 0;
alter table public.staff_devices add column if not exists locked_until timestamptz;

create or replace function public.clock_in_or_out(p_tenant_id uuid, p_device_id uuid, p_device_secret text, p_pin text)
returns table(action text, badge_no text)
language plpgsql
set search_path = public, extensions
as $$
declare
  v_branch_id uuid;
  v_locked_until timestamptz;
  v_failed_attempts integer;
  v_profile record;
  v_open_entry_id uuid;
begin
  if not exists (
    select 1 from public.tenant_modules where tenant_id = p_tenant_id and module_key = 'staff_scheduling' and is_enabled = true
  ) then
    raise exception 'staff_scheduling module not enabled';
  end if;

  select branch_id, locked_until, failed_pin_attempts into v_branch_id, v_locked_until, v_failed_attempts
  from public.staff_devices
  where id = p_device_id and tenant_id = p_tenant_id and is_active = true and device_secret_hash = crypt(p_device_secret, device_secret_hash);
  if v_branch_id is null then
    raise exception 'invalid device';
  end if;
  if v_locked_until is not null and v_locked_until > now() then
    raise exception 'DEVICE_LOCKED:%', v_locked_until;
  end if;

  select p.id, p.badge_no into v_profile
  from public.profiles p
  where p.tenant_id = p_tenant_id and p.is_active = true and p.pin_hash is not null and p.pin_hash = crypt(p_pin, p.pin_hash)
  limit 1;
  if v_profile.id is null then
    update public.staff_devices
    set failed_pin_attempts = failed_pin_attempts + 1,
        locked_until = case when failed_pin_attempts + 1 >= 5 then now() + interval '5 minutes' else locked_until end
    where id = p_device_id;
    raise exception 'invalid pin';
  end if;

  update public.staff_devices set failed_pin_attempts = 0, locked_until = null where id = p_device_id;

  select id into v_open_entry_id
  from public.timeclock_entries
  where profile_id = v_profile.id and clock_out_at is null
  order by clock_in_at desc
  limit 1;

  if v_open_entry_id is not null then
    update public.timeclock_entries set clock_out_at = now() where id = v_open_entry_id;
    return query select 'out'::text, v_profile.badge_no;
  else
    insert into public.timeclock_entries (tenant_id, branch_id, profile_id, device_id)
    values (p_tenant_id, v_branch_id, v_profile.id, p_device_id);
    return query select 'in'::text, v_profile.badge_no;
  end if;
end;
$$;
revoke all on function public.clock_in_or_out(uuid, uuid, text, text) from public;
grant execute on function public.clock_in_or_out(uuid, uuid, text, text) to service_role;

-- reset_staff_pin: iki personelin aynı PIN'i seçmesi, clock_in_or_out'un
-- "limit 1" eşleşmesiyle sessizce YANLIŞ personele giriş/çıkış
-- yazdırabiliyordu (bcrypt salt'ı hash eşitliğini engellemez, PIN'in KENDİSİ
-- aynıysa iki farklı hash de crypt() ile eşleşir). Yeni PIN atanırken
-- tenant içindeki diğer aktif personelin PIN'iyle çakışma reddedilir.
create or replace function public.reset_staff_pin(p_profile_id uuid, p_new_pin text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_tenant_id uuid := public.current_tenant_id();
begin
  if not public.is_staff() then
    raise exception 'staff only';
  end if;
  if not public.current_can('staff.manage') then
    raise exception 'permission denied: staff.manage';
  end if;
  if p_new_pin !~ '^[0-9]{4,8}$' then
    raise exception 'pin must be 4-8 digits';
  end if;

  if exists (
    select 1 from public.profiles
    where tenant_id = v_tenant_id and is_active = true and id <> p_profile_id
      and pin_hash is not null and pin_hash = crypt(p_new_pin, pin_hash)
  ) then
    raise exception 'PIN_ALREADY_IN_USE';
  end if;

  update public.profiles
  set pin_hash = crypt(p_new_pin, gen_salt('bf'))
  where id = p_profile_id and tenant_id = v_tenant_id;

  if not found then
    raise exception 'profile not found';
  end if;
end;
$$;
revoke all on function public.reset_staff_pin(uuid, text) from public;
grant execute on function public.reset_staff_pin(uuid, text) to authenticated;

-- === ORTA: kiosk cihazı iptal edildiğinde (is_active=false) o cihazdan
-- açılmış AKTİF oturumlar açık kalıyordu — misafir siparişe devam edebiliyor,
-- personel panelinde "hangi cihaz hâlâ etkin" belirsizleşiyordu.
alter table public.table_sessions drop constraint if exists table_sessions_close_reason_check;
alter table public.table_sessions add constraint table_sessions_close_reason_check
  check (close_reason in ('payment', 'timeout', 'manual', 'kiosk_revoked'));

create or replace function public.close_kiosk_device_sessions(p_device_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid := public.current_tenant_id();
  v_device_tenant_id uuid;
begin
  if not public.is_staff() then
    raise exception 'staff only';
  end if;

  select tenant_id into v_device_tenant_id from public.kiosk_devices where id = p_device_id and tenant_id = v_tenant_id;
  if v_device_tenant_id is null then
    raise exception 'device not found';
  end if;

  with closed as (
    update public.table_sessions
    set status = 'closed', closed_at = now(), close_reason = 'kiosk_revoked'
    where kiosk_device_id = p_device_id and status = 'active'
    returning id, tenant_id, branch_id
  )
  insert into public.session_events (tenant_id, branch_id, table_session_id, event_type, actor_profile_id, reason)
  select tenant_id, branch_id, id, 'closed', auth.uid(), 'kiosk_revoked' from closed;
end;
$$;
revoke all on function public.close_kiosk_device_sessions(uuid) from public;
grant execute on function public.close_kiosk_device_sessions(uuid) to authenticated;

-- === ORTA: accounting sync eşzamanlı çift-gönderim korumasızdı — aynı
-- siparişe çift tıklama/çift istek, muhasebe sağlayıcısında iki ayrı
-- fatura oluşturabiliyordu. 'pending' durumu + yalnızca pending/success
-- için geçerli partial unique index, aynı siparişe eşzamanlı ikinci
-- "claim" denemesini DB seviyesinde engeller (TOCTOU'suz).
alter table public.accounting_sync_log drop constraint if exists accounting_sync_log_status_check;
alter table public.accounting_sync_log add constraint accounting_sync_log_status_check
  check (status in ('pending', 'success', 'failed'));
create unique index if not exists idx_accounting_sync_log_order_active
  on public.accounting_sync_log(order_id) where status in ('pending', 'success');
-- 0067 yalnızca select/insert grant etmişti (o zamanki tasarım hiç update
-- yapmıyordu) — pending→success/failed geçişi artık update gerektiriyor.
grant update on public.accounting_sync_log to authenticated, service_role;

-- === ORTA: rezervasyon çift-rezervasyon (overlap) koruması yoktu — aynı
-- masaya, çakışan saatlerde birden çok rezervasyon onaylanabiliyordu.
-- Varsayım: 90 dakikalık masa devir süresi (PRD/RULES bir değer
-- belirtmiyor) — EXCLUDE constraint ile eşzamanlılığa karşı da güvenli
-- (uygulama katmanı kontrolü TOCTOU'ya açık olurdu).
create extension if not exists btree_gist;

-- timestamptz +/- interval postgres'te STABLE'dır (ay/gün bileşenli
-- interval'ler saat dilimi/DST'ye bağlı olabilir) — index ifadesi IMMUTABLE
-- gerektirir. Burada interval SAAT/DAKİKA bazlı (ay/gün yok), bu yüzden
-- sonucu gerçekten girdiye deterministik bağlı — sarmalayıcı fonksiyonla
-- IMMUTABLE olarak işaretlemek güvenli.
create or replace function public.reservation_overlap_range(p_reserved_at timestamptz)
returns tstzrange
language sql
immutable
as $$
  select tstzrange(p_reserved_at - interval '45 minutes', p_reserved_at + interval '45 minutes');
$$;

alter table public.reservations add constraint reservations_no_overlap
  exclude using gist (
    tenant_id with =,
    table_id with =,
    public.reservation_overlap_range(reserved_at) with &&
  ) where (table_id is not null and status in ('pending', 'confirmed', 'seated'));
