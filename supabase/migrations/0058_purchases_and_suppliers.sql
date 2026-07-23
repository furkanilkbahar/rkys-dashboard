-- Faz 8 Adım 1 (S35): tedarikçi kartı + basit alım girişi + hareketli
-- ortalama maliyet. PRD §8: "basit alım girişi (stok + hareketli ortalama
-- maliyet) önce; tam satın alma (PO, mal kabul) ileri faz" — bu yüzden
-- purchases tek satırlık bir "aldım, stoğa ekle" kaydı, sipariş/mal kabul
-- akışı yok.

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  contact_info text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index idx_suppliers_tenant_id on public.suppliers(tenant_id);
alter table public.suppliers enable row level security;
create policy "suppliers_select" on public.suppliers for select
  using (tenant_id = public.current_tenant_id() and public.is_staff());
create policy "suppliers_staff_write" on public.suppliers for all
  using (tenant_id = public.current_tenant_id() and public.is_staff())
  with check (tenant_id = public.current_tenant_id() and public.is_staff());
grant select, insert, update, delete on public.suppliers to authenticated;
grant all on public.suppliers to service_role;

create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  supplier_id uuid references public.suppliers(id) on delete set null,
  ingredient_id uuid not null references public.ingredients(id) on delete cascade,
  quantity numeric not null check (quantity > 0),
  unit_cost_minor integer not null check (unit_cost_minor >= 0),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index idx_purchases_tenant_id on public.purchases(tenant_id);
create index idx_purchases_ingredient_id on public.purchases(ingredient_id);
alter table public.purchases enable row level security;
create policy "purchases_select" on public.purchases for select
  using (tenant_id = public.current_tenant_id() and public.is_staff());
grant select on public.purchases to authenticated;
grant all on public.purchases to service_role;

-- record_purchase: hareketli ortalama maliyet (weighted average) —
-- new_avg = (eski_stok*eski_ortalama + alınan_miktar*alım_birim_maliyeti) /
-- (eski_stok+alınan_miktar). Mevcut stok negatifse (RULES yasaklamıyor,
-- bkz. 0057) payda sıfır/negatif olabilir — bu durumda eski ortalamanın
-- ekonomik anlamı kalmadığından yeni ortalama doğrudan alım fiyatına
-- sıfırlanır (Varsayım, düşük riskli edge-case kararı).
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

  return v_purchase_id;
end;
$$;
revoke all on function public.record_purchase(uuid, numeric, integer, uuid) from public;
grant execute on function public.record_purchase(uuid, numeric, integer, uuid) to authenticated;
