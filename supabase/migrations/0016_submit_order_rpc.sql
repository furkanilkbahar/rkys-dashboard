-- submit_order: misafirin tek yazma kapısı. security definer zorunlu —
-- misafirin orders/order_items/product/variant/extra/override tablolarına
-- hiç GRANT'i yok. Tenant/session scope client input'tan değil JWT
-- claim'inden (current_tenant_id/current_table_session_id) okunur; RULES #31
-- idempotency_key + RULES #23 server-side stok kontrolü + RULES #8 basit
-- rate limit (aynı oturumdan 60sn'de 5 sipariş) burada uygulanır.
create or replace function public.submit_order(p_idempotency_key text, p_items jsonb)
-- Çıktı kolonu bilinçli olarak "status" değil "order_status": RETURNS
-- TABLE'ın kolon adları PL/pgSQL'de örtük OUT parametresi/değişkeni olur ve
-- fonksiyon gövdesinde herhangi bir tabloda bare "status" referansıyla
-- (örn. orders/table_sessions.status) SQLSTATE 42702 "ambiguous" hatası
-- verir — bu isimlendirme deseni sonraki sipariş RPC'lerinde de korunur.
returns table(order_id uuid, order_status text, subtotal_minor integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid := public.current_tenant_id();
  v_session_id uuid := public.current_table_session_id();
  v_branch_id uuid;
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
  -- v_variant/v_override "record" değil skaler değişkenlerle tutulur:
  -- varyantsız üründe/override'sız şubede SELECT INTO hiç satır bulamaz ve
  -- bir "record" o durumda "tuple structure indeterminate" (SQLSTATE 55000)
  -- hatası verir — skaler değişkenler basitçe NULL kalır, coalesce() güvenle çalışır.
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
begin
  if public.current_role() <> 'guest' or v_session_id is null then
    raise exception 'guest table session required';
  end if;

  -- Idempotency: aynı anahtarla daha önce gönderilmişse mevcut siparişi döner.
  return query
    select o.id, o.status, o.subtotal_minor
    from public.orders o
    where o.table_session_id = v_session_id and o.idempotency_key = p_idempotency_key;
  if found then
    return;
  end if;

  select branch_id into v_branch_id
  from public.table_sessions
  where id = v_session_id and status = 'active' and tenant_id = v_tenant_id
  for update;
  if not found then
    raise exception 'table session is not active';
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
    (tenant_id, branch_id, table_session_id, placed_by_device_id, status, idempotency_key, subtotal_minor)
  values (v_tenant_id, v_branch_id, v_session_id, v_device_id, v_status, p_idempotency_key, 0)
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_qty := coalesce((v_item ->> 'quantity')::integer, 0);
    if v_qty <= 0 or v_qty > 20 then
      raise exception 'invalid quantity';
    end if;

    select id, base_price_minor, stock_quantity, is_sold_out, is_active into v_product
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

    -- Stok en spesifik seviyede (override → varyant → ürün) düşülür.
    if v_override_id is not null and v_override_stock is not null then
      update public.branch_product_overrides set stock_quantity = stock_quantity - v_qty where id = v_override_id;
    elsif v_variant_id is not null and v_variant_stock is not null then
      update public.product_variants set stock_quantity = stock_quantity - v_qty where id = v_variant_id;
    elsif v_variant_id is null and v_product.stock_quantity is not null then
      update public.products set stock_quantity = stock_quantity - v_qty where id = v_product.id;
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

  update public.orders set subtotal_minor = v_line_total, updated_at = now() where id = v_order_id;
  update public.table_sessions set last_activity_at = now() where id = v_session_id;

  return query select v_order_id, v_status, v_line_total;
end;
$$;

revoke all on function public.submit_order(text, jsonb) from public;
grant execute on function public.submit_order(text, jsonb) to authenticated;
