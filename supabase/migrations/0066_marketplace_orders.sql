-- Faz 10 Adım 2 (S43): Pazar yeri (marketplace) kanalı — D70 karma strateji.
--
-- Mimari karar: ARCHITECTURE.md #5 "kanal tek motoru" — marketplace siparişi
-- de AYRI bir tablo/durum makinesi almaz, orders.channel zaten 0015'te
-- 'marketplace' değerini kabul ediyordu (Faz 1'den beri future-proof),
-- tenant_modules.module_key de 0005'ten beri 'marketplace' anahtarını
-- tanıyordu — bu adım yalnızca table_sessions.channel'a aynı değeri ekler
-- ve gerçek yazma (ingestion) yolunu kurar.
--
-- Kimlik doğrulama kararı: marketplace webhook'ları için ayrı bir "entegre
-- hesap" tablosu icat edilmez — tenant, Faz 10 Adım 0'da kurulan api_keys
-- mekanizmasının ürettiği anahtarı aracı platforma (Posentegra/Entegre App
-- vb.) verir; inbound sipariş isteği bu anahtarla kimliklenir (bkz.
-- src/lib/api/auth.ts authenticateApiRequest — burada yeniden kullanılır).
--
-- SKU eşleme: marketplace'teki bir ürün kodu (external_sku) ile bizim
-- products.id'imiz arasında admin'in kurduğu bire-bir eşleme
-- (product_external_mappings). v1 kapsamı: yalnızca ürün seviyesi (varyant/
-- ekstra YOK) — aracı platformların SKU'ları zaten çoğunlukla satılabilir
-- birimi tek başına temsil eder (Varsayım, PLAN.md'nin "yazma API'si" kapsamı
-- ile orantılı).
--
-- Stok/reçete tutarlılığı: submit_order/submit_staff_order'ın stok düşme
-- davranışı burada da korunur (aynı deduct_recipe_stock RPC'si, 0057)
-- — aksi halde marketplace kanalı diğer kanallardan farklı envanter
-- davranışına sahip olur, bu da "kanal tek motoru" ilkesini bozar.

alter table public.table_sessions drop constraint if exists table_sessions_channel_check;
alter table public.table_sessions add constraint table_sessions_channel_check
  check (channel in ('dine_in', 'pickup', 'delivery', 'marketplace'));

alter table public.table_sessions add column external_provider text;
alter table public.table_sessions add column external_order_id text;
-- Aynı external_order_id'nin iki kez POST edilmesi (aracı platformların
-- timeout sonrası retry etmesi yaygın) idempotency kontrolünde kullanılır.
create unique index idx_table_sessions_external_order
  on public.table_sessions(tenant_id, external_provider, external_order_id)
  where external_order_id is not null;

create table public.product_external_mappings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  provider text not null,
  external_sku text not null,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (tenant_id, provider, external_sku)
);
create index idx_product_external_mappings_tenant on public.product_external_mappings(tenant_id);

alter table public.product_external_mappings enable row level security;
create policy "product_external_mappings_staff" on public.product_external_mappings for all
  using (tenant_id = public.current_tenant_id() and public.is_staff())
  with check (tenant_id = public.current_tenant_id() and public.is_staff());
grant select, insert, update, delete on public.product_external_mappings to authenticated, service_role;

-- ingest_marketplace_order: service_role tarafından (Next.js API route,
-- api_keys ile kimliklenmiş isteğin ardından) çağrılır — open_pickup_session
-- (0061) gibi yalnızca service_role'e GRANT edilir, RLS zaten bypass edilir,
-- security definer'a gerek yok.
create or replace function public.ingest_marketplace_order(
  p_tenant_id uuid,
  p_provider text,
  p_external_order_id text,
  p_items jsonb -- [{externalSku, quantity, unitPriceMinor, name}, ...]
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

  select id into v_branch_id from public.branches where tenant_id = p_tenant_id and is_default = true;
  if v_branch_id is null then
    raise exception 'invalid tenant';
  end if;

  if jsonb_array_length(p_items) = 0 then
    raise exception 'empty order';
  end if;

  insert into public.table_sessions (tenant_id, branch_id, table_id, channel, external_provider, external_order_id)
  values (p_tenant_id, v_branch_id, null, 'marketplace', p_provider, p_external_order_id)
  returning id into v_session_id;

  insert into public.session_events (tenant_id, branch_id, table_session_id, event_type)
  values (p_tenant_id, v_branch_id, v_session_id, 'opened');

  -- Marketplace siparişleri aracı platformda zaten ödenmiş/onaylanmıştır —
  -- personel onayı beklemeden doğrudan 'approved' ile mutfağa düşer (pickup/
  -- delivery'nin aksine, submit_order'ın 'pending' başlangıcı burada geçerli
  -- değil, çünkü misafir tarafından değil aracı platformdan gelir).
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
    v_unit_price := coalesce((v_item ->> 'unitPriceMinor')::integer, 0);

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
