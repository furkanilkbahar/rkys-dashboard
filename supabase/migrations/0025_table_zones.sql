-- Faz 2 Adım 4: masa bölgeleri (Salon/Teras vb.) — mevcut call_types
-- lookup-table deseniyle aynı: doğrudan is_staff() grant'i, RPC gerekmez.
create table public.table_zones (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  name text not null,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index idx_table_zones_tenant_id on public.table_zones(tenant_id);
create index idx_table_zones_branch_id on public.table_zones(branch_id);
alter table public.table_zones enable row level security;
-- tables ile aynı desen (tables_staff_all, 0011): bölgeler saf personel
-- organizasyon detayı, misafir tarafında hiç kullanılmıyor — guest'e
-- doğrudan erişim yok.
create policy "table_zones_staff_all" on public.table_zones for all
  using (tenant_id = public.current_tenant_id() and public.is_staff())
  with check (tenant_id = public.current_tenant_id() and public.is_staff());
grant select, insert, update, delete on public.table_zones to authenticated, service_role;

alter table public.tables add column zone_id uuid references public.table_zones(id) on delete set null;
