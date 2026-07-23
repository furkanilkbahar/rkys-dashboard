-- Faz 8 Adım 3 (S37): reçeteden otomatik maliyet + menü mühendisliği matrisi.
--
-- Varsayım: product_costs (0035) yalnızca product_id başına tek satır tutar
-- (variant_id kolonu yok) — bu yüzden otomatik maliyet yalnızca ÜRÜN
-- SEVİYESİ reçeteye (variant_id is null) göre hesaplanır; yalnızca varyanta
-- özel reçetesi olan ürünler otomatik maliyetlenmez (manuel maliyet girişi
-- geçerliliğini korur). Bu, mevcut get_margin_report'un zaten varyant
-- ayrımı yapmayan ürün-seviyesi granülaritesiyle tutarlı.

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
  select tenant_id into v_tenant_id from public.products where id = p_product_id;
  if v_tenant_id is null then
    return;
  end if;

  select id into v_recipe_id from public.recipes where product_id = p_product_id and variant_id is null;
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

-- Bir malzemenin ortalama maliyeti değiştiğinde (yalnızca alım girişinde,
-- bkz. record_purchase 0058), onu kullanan tüm ürün-seviyesi reçetelerin
-- maliyeti yeniden hesaplanır.
create or replace function public.recompute_costs_for_ingredient(p_ingredient_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product_id uuid;
begin
  for v_product_id in
    select distinct r.product_id
    from public.recipe_items ri
    join public.recipes r on r.id = ri.recipe_id and r.variant_id is null
    where ri.ingredient_id = p_ingredient_id
  loop
    perform public.recompute_product_cost(v_product_id);
  end loop;
end;
$$;
revoke all on function public.recompute_costs_for_ingredient(uuid) from public;
grant execute on function public.recompute_costs_for_ingredient(uuid) to authenticated, service_role;

-- record_purchase (0058) genişletmesi: alım sonrası etkilenen ürün
-- maliyetleri otomatik güncellenir. Gövde birebir aynı, sona tek satır eklendi.
create or replace function public.record_purchase(
  p_ingredient_id uuid, p_quantity numeric, p_unit_cost_minor integer, p_supplier_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid := public.current_tenant_id();
  v_branch_id uuid;
  v_old_stock numeric;
  v_old_avg_cost numeric;
  v_new_stock numeric;
  v_new_avg_cost numeric;
  v_purchase_id uuid;
begin
  if not public.is_staff() then
    raise exception 'staff only';
  end if;
  if not exists (
    select 1 from public.tenant_modules
    where tenant_id = v_tenant_id and module_key = 'inventory' and is_enabled = true
  ) then
    raise exception 'inventory module not enabled';
  end if;
  if p_quantity <= 0 then
    raise exception 'invalid quantity';
  end if;

  select current_stock, avg_cost_minor_per_unit into v_old_stock, v_old_avg_cost
  from public.ingredients
  where id = p_ingredient_id and tenant_id = v_tenant_id
  for update;
  if not found then
    raise exception 'invalid ingredient';
  end if;

  select id into v_branch_id from public.branches where tenant_id = v_tenant_id and is_default = true;

  v_new_stock := v_old_stock + p_quantity;
  if v_new_stock <= 0 then
    v_new_avg_cost := p_unit_cost_minor;
  else
    v_new_avg_cost := (v_old_stock * v_old_avg_cost + p_quantity * p_unit_cost_minor) / v_new_stock;
  end if;

  update public.ingredients
  set current_stock = v_new_stock, avg_cost_minor_per_unit = v_new_avg_cost, updated_at = now()
  where id = p_ingredient_id;

  insert into public.purchases (tenant_id, branch_id, supplier_id, ingredient_id, quantity, unit_cost_minor, created_by)
  values (v_tenant_id, v_branch_id, p_supplier_id, p_ingredient_id, p_quantity, p_unit_cost_minor, auth.uid())
  returning id into v_purchase_id;

  insert into public.stock_movements (tenant_id, branch_id, ingredient_id, type, quantity_delta, unit_cost_minor_snapshot)
  values (v_tenant_id, v_branch_id, p_ingredient_id, 'purchase', p_quantity, p_unit_cost_minor);

  perform public.recompute_costs_for_ingredient(p_ingredient_id);

  return v_purchase_id;
end;
$$;

-- get_menu_engineering_matrix: klasik menü mühendisliği matrisi (popülerlik ×
-- marj), her iki eksen de dönem ORTALAMASINA göre kıyaslanır (BCG matrisi
-- yöntemi). get_margin_report ile aynı reports.profit izni + maliyeti
-- olmayan ürünler için 0 maliyet varsayımı (tutarlılık).
create or replace function public.get_menu_engineering_matrix(p_branch_id uuid, p_start_date date, p_end_date date)
returns table(
  product_name text, quantity integer, revenue_minor integer, cost_minor integer, margin_minor integer, category text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid := public.current_tenant_id();
  v_timezone text;
begin
  if not public.current_can('reports.profit') then
    raise exception 'forbidden';
  end if;
  select timezone into v_timezone from public.tenants where id = v_tenant_id;

  return query
  with per_product as (
    select
      oi.product_name_snapshot as product_name,
      sum(oi.quantity)::integer as quantity,
      sum(oi.line_subtotal_minor)::integer as revenue_minor,
      coalesce(sum(oi.quantity * pc.cost_minor), 0)::integer as cost_minor
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    left join public.product_costs pc on pc.product_id = oi.product_id
    where oi.branch_id = p_branch_id and oi.tenant_id = v_tenant_id and o.status <> 'cancelled'
      and (oi.created_at at time zone coalesce(v_timezone, 'UTC'))::date between p_start_date and p_end_date
    group by oi.product_name_snapshot
  ),
  with_margin as (
    select pp.*, (pp.revenue_minor - pp.cost_minor) as margin_minor from per_product pp
  ),
  averages as (
    select avg(wm.quantity) as avg_quantity, avg(wm.margin_minor) as avg_margin from with_margin wm
  )
  select
    wm.product_name, wm.quantity, wm.revenue_minor, wm.cost_minor, wm.margin_minor,
    case
      when wm.quantity >= a.avg_quantity and wm.margin_minor >= a.avg_margin then 'star'
      when wm.quantity >= a.avg_quantity and wm.margin_minor < a.avg_margin then 'plowhorse'
      when wm.quantity < a.avg_quantity and wm.margin_minor >= a.avg_margin then 'puzzle'
      else 'dog'
    end as category
  from with_margin wm, averages a
  order by wm.revenue_minor desc;
end;
$$;
revoke all on function public.get_menu_engineering_matrix(uuid, date, date) from public;
grant execute on function public.get_menu_engineering_matrix(uuid, date, date) to authenticated;
