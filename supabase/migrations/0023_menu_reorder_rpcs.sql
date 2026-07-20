-- Faz 2 Adım 2: sürükle-bırak sıralama. Her varlık tipi için tek atomik
-- UPDATE (unnest ... with ordinality) — client-side sıralı PATCH döngüsü
-- yerine, kısmi yazım/yarış riskini ortadan kaldırır. tenant_id + kapsam
-- (category_id/product_id) filtresi, dizideki yabancı bir id'nin sessizce
-- yok sayılmasını garanti eder (başka tenant/kategori/ürüne sızma yok).

create or replace function public.reorder_menu_categories(p_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    raise exception 'staff only';
  end if;

  update public.menu_categories c
  set display_order = x.ord - 1
  from unnest(p_ids) with ordinality as x(id, ord)
  where c.id = x.id and c.tenant_id = public.current_tenant_id();
end;
$$;
revoke all on function public.reorder_menu_categories(uuid[]) from public;
grant execute on function public.reorder_menu_categories(uuid[]) to authenticated;

create or replace function public.reorder_products(p_category_id uuid, p_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    raise exception 'staff only';
  end if;

  update public.products p
  set display_order = x.ord - 1
  from unnest(p_ids) with ordinality as x(id, ord)
  where p.id = x.id and p.tenant_id = public.current_tenant_id() and p.category_id = p_category_id;
end;
$$;
revoke all on function public.reorder_products(uuid, uuid[]) from public;
grant execute on function public.reorder_products(uuid, uuid[]) to authenticated;

create or replace function public.reorder_product_variants(p_product_id uuid, p_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    raise exception 'staff only';
  end if;

  update public.product_variants v
  set display_order = x.ord - 1
  from unnest(p_ids) with ordinality as x(id, ord)
  where v.id = x.id and v.tenant_id = public.current_tenant_id() and v.product_id = p_product_id;
end;
$$;
revoke all on function public.reorder_product_variants(uuid, uuid[]) from public;
grant execute on function public.reorder_product_variants(uuid, uuid[]) to authenticated;

create or replace function public.reorder_product_extras(p_product_id uuid, p_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    raise exception 'staff only';
  end if;

  update public.product_extras e
  set display_order = x.ord - 1
  from unnest(p_ids) with ordinality as x(id, ord)
  where e.id = x.id and e.tenant_id = public.current_tenant_id() and e.product_id = p_product_id;
end;
$$;
revoke all on function public.reorder_product_extras(uuid, uuid[]) from public;
grant execute on function public.reorder_product_extras(uuid, uuid[]) to authenticated;
