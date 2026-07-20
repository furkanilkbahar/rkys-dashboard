-- Etkin menü okuma modeli: override → varyant → ürün sırasıyla fiyat/stok
-- fallback zinciri. security_invoker=true (PG15+) sayesinde view, view
-- sahibinin değil SORGULAYAN kullanıcının RLS'ine tabidir — ayrı bir yetki
-- kontrolü gerekmez, products/product_variants/branch_product_overrides
-- politikaları zaten geçerli olur.
create view public.effective_menu_items with (security_invoker = true) as
select
  p.id as product_id,
  p.tenant_id,
  p.category_id,
  v.id as variant_id,
  b.id as branch_id,
  coalesce(o.price_minor, v.price_minor, p.base_price_minor) as effective_price_minor,
  coalesce(o.is_available, true)
    and not coalesce(o.is_sold_out, v.is_sold_out, p.is_sold_out, false)
    and coalesce(o.stock_quantity, v.stock_quantity, p.stock_quantity, 1) > 0
    as is_orderable
from public.products p
join public.branches b on b.tenant_id = p.tenant_id
left join public.product_variants v on v.product_id = p.id and v.is_active
left join public.branch_product_overrides o
  on o.branch_id = b.id
  and o.product_id = p.id
  and (o.variant_id = v.id or (o.variant_id is null and v.id is null))
where p.is_active;

-- Görünümlerin de PostgREST GRANT'ine ihtiyacı var (auto_expose_new_tables=false).
grant select on public.effective_menu_items to authenticated, service_role;
