-- Faz 3 Adım 1: POS-lite sipariş girişi. submit_order (0016) misafire
-- kilitli (current_role()='guest' + current_table_session_id() JWT claim'i)
-- — personelin kasadan sipariş girmesi için ayrı bir kapı gerekiyor.
-- open_or_get_active_table_session yalnızca service_role'e açık (misafir
-- bootstrap route handler'ı üzerinden çağrılıyor); personel tarafı burada
-- aynı "aktif oturumu getir/yoksa aç" mantığını kendi içinde tekrarlar ki
-- Faz 1'in iyi test edilmiş guest-bootstrap koduna dokunulmasın.
--
-- Varsayım: yetki sınırı is_staff() + pos_cash modülü açık olması (herhangi
-- bir personel kasadan sipariş girebilir — mevcut PERMISSION_KEYS'te POS
-- sipariş girişine özel bir anahtar yok, fiziksel bir kasada da herhangi bir
-- vardiyalı personel satış yapabilir). Varsayım: POS-lite siparişleri
-- tenant_settings.order_mode'dan bağımsız her zaman 'approved' başlar —
-- personel zaten siparişi kendi girip onaylamış oluyor, guest'in
-- kendi-kendine-sipariş onay adımı burada anlamsız.
create or replace function public.submit_staff_order(p_table_id uuid, p_items jsonb)
returns table(order_id uuid, order_status text, subtotal_minor integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid := public.current_tenant_id();
  v_branch_id uuid;
  v_session_id uuid;
  v_status text := 'approved';
  v_order_id uuid;
  v_default_locale text;
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
begin
  if not public.is_staff() then
    raise exception 'staff only';
  end if;

  select branch_id into v_branch_id
  from public.tables
  where id = p_table_id and tenant_id = v_tenant_id and is_active;
  if not found then
    raise exception 'invalid or inactive table';
  end if;

  if not exists (
    select 1 from public.tenant_modules
    where tenant_id = v_tenant_id and module_key = 'pos_cash' and is_enabled
  ) then
    raise exception 'pos_cash module disabled';
  end if;

  if jsonb_array_length(p_items) = 0 then
    raise exception 'empty order';
  end if;

  select id into v_session_id
  from public.table_sessions
  where table_id = p_table_id and status = 'active'
  for update;

  if v_session_id is null then
    insert into public.table_sessions (tenant_id, branch_id, table_id)
    values (v_tenant_id, v_branch_id, p_table_id)
    returning id into v_session_id;

    insert into public.session_events (tenant_id, branch_id, table_session_id, event_type)
    values (v_tenant_id, v_branch_id, v_session_id, 'opened');
  end if;

  select locale into v_default_locale
  from public.tenant_locales
  where tenant_id = v_tenant_id and is_default = true
  limit 1;

  insert into public.orders
    (tenant_id, branch_id, table_session_id, placed_by_device_id, status, idempotency_key, subtotal_minor)
  values (v_tenant_id, v_branch_id, v_session_id, null, v_status, gen_random_uuid()::text, 0)
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

revoke all on function public.submit_staff_order(uuid, jsonb) from public;
grant execute on function public.submit_staff_order(uuid, jsonb) to authenticated;
