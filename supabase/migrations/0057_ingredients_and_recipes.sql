-- Faz 8 Adım 0 (S34): malzeme + reçete şeması + reçeteden stok düşümü.
-- Ledger deseni cash_movements/loyalty_transactions ile aynı: immutable
-- stock_movements + materyalize edilmiş ingredients.current_stock/avg_cost
-- (coupons.used_count / loyalty_balances emsali). RULES #39: reçete düşümü
-- yalnızca server-side (submit_order/submit_staff_order RPC'leri içinde).
--
-- Varsayım: current_stock negatife düşebilir (RULES bunu yasaklamıyor —
-- gift_cards #37'nin aksine; gerçek mutfaklarda servis sırasında malzeme
-- bitebilir, sipariş bu yüzden reddedilmez, kritik seviye uyarısı Adım 2'de
-- ayrıca sunulur). Varsayım: avg_cost_minor_per_unit numeric (kesirli) tutulur
-- — "para kuruş integer" kuralı nihai/müşteriye görünen tutarlar için
-- (product_costs.cost_minor Adım 3'te integer'a yuvarlanarak yazılır), dahili
-- birim maliyet ara hesaplaması kesirli olmadan (örn. kg→g) hassasiyet kaybeder.
-- Varsayım: recipe_items.quantity_per_unit tek bir birim sistemi varsayar
-- (ingredient'ın kendi unit'i), v1'de birim dönüşümü yok.

create table public.ingredients (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  unit text not null check (unit in ('g', 'kg', 'ml', 'l', 'adet')),
  critical_level numeric not null default 0 check (critical_level >= 0),
  current_stock numeric not null default 0,
  avg_cost_minor_per_unit numeric not null default 0 check (avg_cost_minor_per_unit >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_ingredients_tenant_id on public.ingredients(tenant_id);
alter table public.ingredients enable row level security;
create policy "ingredients_select" on public.ingredients for select
  using (tenant_id = public.current_tenant_id() and public.is_staff());
create policy "ingredients_staff_write" on public.ingredients for all
  using (tenant_id = public.current_tenant_id() and public.is_staff())
  with check (tenant_id = public.current_tenant_id() and public.is_staff());
grant select, insert, update, delete on public.ingredients to authenticated;
grant all on public.ingredients to service_role;

-- recipe: (product_id, variant_id) çifti başına tek reçete — override→varyant→
-- ürün spesifiklik deseninin (submit_order) reçete tarafındaki karşılığı.
-- Nullable variant_id ile "unique" kısıtı postgres'te NULL'ları farklı satır
-- sayar, bu yüzden iki kısmi unique index kullanılıyor.
create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index idx_recipes_tenant_id on public.recipes(tenant_id);
create unique index idx_recipes_product_only on public.recipes(product_id) where variant_id is null;
create unique index idx_recipes_product_variant on public.recipes(product_id, variant_id) where variant_id is not null;
alter table public.recipes enable row level security;
create policy "recipes_select" on public.recipes for select
  using (tenant_id = public.current_tenant_id() and public.is_staff());
create policy "recipes_staff_write" on public.recipes for all
  using (tenant_id = public.current_tenant_id() and public.is_staff())
  with check (tenant_id = public.current_tenant_id() and public.is_staff());
grant select, insert, update, delete on public.recipes to authenticated;
grant all on public.recipes to service_role;

create table public.recipe_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete cascade,
  quantity_per_unit numeric not null check (quantity_per_unit > 0),
  unique (recipe_id, ingredient_id)
);
create index idx_recipe_items_tenant_id on public.recipe_items(tenant_id);
create index idx_recipe_items_recipe_id on public.recipe_items(recipe_id);
alter table public.recipe_items enable row level security;
create policy "recipe_items_select" on public.recipe_items for select
  using (tenant_id = public.current_tenant_id() and public.is_staff());
create policy "recipe_items_staff_write" on public.recipe_items for all
  using (tenant_id = public.current_tenant_id() and public.is_staff())
  with check (tenant_id = public.current_tenant_id() and public.is_staff());
grant select, insert, update, delete on public.recipe_items to authenticated;
grant all on public.recipe_items to service_role;

-- stock_movements: immutable ledger — Adım 0'da yalnızca 'sale_deduction'
-- yazılır; 'purchase' Adım 1'de, 'waste'/'count_adjustment' Adım 2'de.
create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  ingredient_id uuid not null references public.ingredients(id) on delete cascade,
  type text not null check (type in ('purchase', 'sale_deduction', 'waste', 'count_adjustment')),
  quantity_delta numeric not null check (quantity_delta <> 0),
  unit_cost_minor_snapshot numeric not null default 0,
  order_id uuid references public.orders(id) on delete set null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index idx_stock_movements_tenant_id on public.stock_movements(tenant_id);
create index idx_stock_movements_ingredient_id on public.stock_movements(ingredient_id);
alter table public.stock_movements enable row level security;
create policy "stock_movements_select" on public.stock_movements for select
  using (tenant_id = public.current_tenant_id() and public.is_staff());
grant select on public.stock_movements to authenticated;
grant all on public.stock_movements to service_role;

-- deduct_recipe_stock: submit_order/submit_staff_order içinden çağrılır.
-- recipes modülü kapalıysa veya ürünün reçetesi yoksa sessizce atlanır
-- (sadakatin auto-earn'ünde olduğu gibi — opsiyonel bir katman, siparişi
-- bloklamaz). Varyant-spesifik reçete önce aranır, yoksa ürün-seviyesi reçeteye
-- düşer (submit_order'ın override→varyant→ürün desenine paralel).
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
    where product_id = p_product_id and variant_id = p_variant_id;
  end if;
  if v_recipe_id is null then
    select id into v_recipe_id from public.recipes
    where product_id = p_product_id and variant_id is null;
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
revoke all on function public.deduct_recipe_stock(uuid, uuid, uuid, uuid, integer, uuid) from public;
grant execute on function public.deduct_recipe_stock(uuid, uuid, uuid, uuid, integer, uuid) to authenticated, service_role;

-- submit_order (0016) genişletmesi: track_mode seçilip reçete düşümü
-- item döngüsünün sonunda çağrılır. Geri kalan gövde birebir aynı.
create or replace function public.submit_order(p_idempotency_key text, p_items jsonb)
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

  update public.orders set subtotal_minor = v_line_total, updated_at = now() where id = v_order_id;
  update public.table_sessions set last_activity_at = now() where id = v_session_id;

  return query select v_order_id, v_status, v_line_total;
end;
$$;

revoke all on function public.submit_order(text, jsonb) from public;
grant execute on function public.submit_order(text, jsonb) to authenticated;

-- submit_staff_order (0030) aynı genişletme.
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

  update public.orders set subtotal_minor = v_line_total, updated_at = now() where id = v_order_id;
  update public.table_sessions set last_activity_at = now() where id = v_session_id;

  return query select v_order_id, v_status, v_line_total;
end;
$$;

revoke all on function public.submit_staff_order(uuid, jsonb) from public;
grant execute on function public.submit_staff_order(uuid, jsonb) to authenticated;
