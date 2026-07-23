-- Faz 8 Adım 2 (S36): fire (waste) ve sayım (count_adjustment) hareketleri.
-- reason_codes tablosuna bağlanmadı (Varsayım) — o tablo comps/refund/
-- cancel/campaign/loyalty gibi FİNANSAL ledger'a (comps) yazılan kayıtlar
-- için; fire/sayım salt envanter hareketi, serbest metin not yeterli.

alter table public.stock_movements add column note text;

create or replace function public.record_stock_waste(p_ingredient_id uuid, p_quantity numeric, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid := public.current_tenant_id();
  v_branch_id uuid;
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

  if not exists (select 1 from public.ingredients where id = p_ingredient_id and tenant_id = v_tenant_id) then
    raise exception 'invalid ingredient';
  end if;

  select id into v_branch_id from public.branches where tenant_id = v_tenant_id and is_default = true;

  update public.ingredients
  set current_stock = current_stock - p_quantity, updated_at = now()
  where id = p_ingredient_id;

  insert into public.stock_movements (tenant_id, branch_id, ingredient_id, type, quantity_delta, unit_cost_minor_snapshot, created_by, note)
  select v_tenant_id, v_branch_id, p_ingredient_id, 'waste', -1 * p_quantity, avg_cost_minor_per_unit, auth.uid(), p_note
  from public.ingredients where id = p_ingredient_id;
end;
$$;
revoke all on function public.record_stock_waste(uuid, numeric, text) from public;
grant execute on function public.record_stock_waste(uuid, numeric, text) to authenticated;

-- record_stock_count: fiziksel sayım sonucu current_stock'u doğrudan
-- p_counted_quantity'e eşitler; fark bir count_adjustment satırı olarak
-- ledger'a yazılır (RULES #18: geçmiş asla silinmez/yeniden hesaplanmaz —
-- düzeltme her zaman yeni bir satır).
create or replace function public.record_stock_count(p_ingredient_id uuid, p_counted_quantity numeric)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid := public.current_tenant_id();
  v_branch_id uuid;
  v_old_stock numeric;
  v_delta numeric;
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
  if p_counted_quantity < 0 then
    raise exception 'invalid quantity';
  end if;

  select current_stock into v_old_stock from public.ingredients
  where id = p_ingredient_id and tenant_id = v_tenant_id
  for update;
  if not found then
    raise exception 'invalid ingredient';
  end if;

  v_delta := p_counted_quantity - v_old_stock;
  if v_delta = 0 then
    return;
  end if;

  select id into v_branch_id from public.branches where tenant_id = v_tenant_id and is_default = true;

  update public.ingredients
  set current_stock = p_counted_quantity, updated_at = now()
  where id = p_ingredient_id;

  insert into public.stock_movements (tenant_id, branch_id, ingredient_id, type, quantity_delta, unit_cost_minor_snapshot)
  select v_tenant_id, v_branch_id, p_ingredient_id, 'count_adjustment', v_delta, avg_cost_minor_per_unit
  from public.ingredients where id = p_ingredient_id;
end;
$$;
revoke all on function public.record_stock_count(uuid, numeric) from public;
grant execute on function public.record_stock_count(uuid, numeric) to authenticated;
