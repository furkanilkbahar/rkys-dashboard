-- Faz 11 Adım 0 (S45): Rezervasyon + bekleme listesi (D63).
--
-- Kapsam kararı (Varsayım): "masa haritası entegrasyonu" (PRD.md §Faz 11)
-- bu kod tabanında zaten var olan bölge/masa listesi (table_zones/tables,
-- 0025) üzerinden okunur — ayrı bir x/y koordinat haritası icat edilmez,
-- admin ekranı mevcut "Masa Seç" combobox desenini (ör. kasa) klonlar.
--
-- Guest-tarafı yazma deseni: bir rezervasyon talebi, misafirin QR okutup
-- table_session açtığı akıştan TAMAMEN farklıdır — ziyaret öncesi, oturumsuz
-- bir web formudur. Bu yüzden guest RLS politikası YOK; misafir tarafı
-- server action'ı registerTenant (kayit/actions.ts) ile aynı deseni
-- kullanır: createServiceRoleClient() ile RLS bypass edilir, güvenlik
-- Zod doğrulaması + modül kontrolüyle sağlanır (tabloya doğrudan
-- authenticated/anon GRANT'i yok).
--
-- Bekleme listesi v1 kapsamı (Varsayım): yalnızca personel walk-in ekler
-- (PRD "bekleme listesi ve çağırma" misafir self-check-in'i belirtmiyor);
-- bu yüzden waitlist_entries tamamen personel tarafı CRUD, RPC gerektirmez
-- (suppliers/ingredients emsaliyle aynı basit tablo deseni).
create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  table_id uuid references public.tables(id) on delete set null,
  customer_name text not null,
  customer_phone text not null,
  party_size integer not null check (party_size > 0),
  reserved_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'seated', 'cancelled', 'no_show')),
  note text,
  created_by uuid references public.profiles(id),
  confirmed_at timestamptz,
  seated_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_reservations_tenant_id on public.reservations(tenant_id);
create index idx_reservations_tenant_branch_status on public.reservations(tenant_id, branch_id, status);

alter table public.reservations enable row level security;
create policy "reservations_staff_all" on public.reservations for all
  using (tenant_id = public.current_tenant_id() and public.is_staff())
  with check (tenant_id = public.current_tenant_id() and public.is_staff());
grant select, insert, update, delete on public.reservations to authenticated, service_role;

create table public.waitlist_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  customer_name text not null,
  customer_phone text,
  party_size integer not null check (party_size > 0),
  status text not null default 'waiting' check (status in ('waiting', 'called', 'seated', 'cancelled')),
  called_at timestamptz,
  seated_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_waitlist_entries_tenant_branch_status on public.waitlist_entries(tenant_id, branch_id, status);

alter table public.waitlist_entries enable row level security;
create policy "waitlist_entries_staff_all" on public.waitlist_entries for all
  using (tenant_id = public.current_tenant_id() and public.is_staff())
  with check (tenant_id = public.current_tenant_id() and public.is_staff());
grant select, insert, update, delete on public.waitlist_entries to authenticated, service_role;
