-- orders/order_items/order_item_extras: RULES #5 gereği misafire (ve
-- personele) hiçbir INSERT/UPDATE/DELETE GRANT'i verilmez — tüm mutasyonlar
-- SECURITY DEFINER RPC'lerden geçer (submit_order, 0016; ileride durum
-- makinesi RPC'leri, Adım 5). RULES #18: fiyat/isim siparişe KOPYALANIR,
-- geçmiş veri asla yeniden hesaplanmaz.
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  table_session_id uuid not null references public.table_sessions(id) on delete restrict,
  channel text not null default 'dine_in'
    check (channel in ('dine_in', 'pickup', 'delivery', 'marketplace')), -- Faz1: yalnız dine_in yazılır
  placed_by_device_id uuid references public.table_session_devices(id),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'preparing', 'ready', 'served', 'cancelled')),
  cancel_requested_at timestamptz,
  cancel_requested_reason text,
  idempotency_key text not null,
  subtotal_minor integer not null default 0 check (subtotal_minor >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (table_session_id, idempotency_key)
);
create index idx_orders_tenant_id on public.orders(tenant_id);
create index idx_orders_table_session_id on public.orders(table_session_id);
create index idx_orders_tenant_branch_status on public.orders(tenant_id, branch_id, status);
alter table public.orders enable row level security;
create policy "orders_select" on public.orders for select
  using (
    (tenant_id = public.current_tenant_id() and public.is_staff())
    or table_session_id = public.current_table_session_id()
  );
grant select on public.orders to authenticated;
grant select, insert, update, delete on public.orders to service_role;

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  table_session_id uuid not null references public.table_sessions(id) on delete cascade, -- RLS için denormalize
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  variant_id uuid references public.product_variants(id) on delete restrict,
  product_name_snapshot text not null,
  variant_name_snapshot text,
  unit_price_minor integer not null check (unit_price_minor >= 0),
  quantity integer not null check (quantity > 0),
  line_subtotal_minor integer not null check (line_subtotal_minor >= 0),
  created_at timestamptz not null default now()
);
create index idx_order_items_tenant_id on public.order_items(tenant_id);
create index idx_order_items_order_id on public.order_items(order_id);
create index idx_order_items_table_session_id on public.order_items(table_session_id);
alter table public.order_items enable row level security;
create policy "order_items_select" on public.order_items for select
  using (
    (tenant_id = public.current_tenant_id() and public.is_staff())
    or table_session_id = public.current_table_session_id()
  );
grant select on public.order_items to authenticated;
grant select, insert, update, delete on public.order_items to service_role;

create table public.order_item_extras (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  table_session_id uuid not null references public.table_sessions(id) on delete cascade,
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  extra_id uuid not null references public.product_extras(id) on delete restrict,
  extra_name_snapshot text not null,
  unit_price_minor integer not null check (unit_price_minor >= 0),
  created_at timestamptz not null default now()
);
create index idx_order_item_extras_tenant_id on public.order_item_extras(tenant_id);
create index idx_order_item_extras_order_item_id on public.order_item_extras(order_item_id);
alter table public.order_item_extras enable row level security;
create policy "order_item_extras_select" on public.order_item_extras for select
  using (
    (tenant_id = public.current_tenant_id() and public.is_staff())
    or table_session_id = public.current_table_session_id()
  );
grant select on public.order_item_extras to authenticated;
grant select, insert, update, delete on public.order_item_extras to service_role;
