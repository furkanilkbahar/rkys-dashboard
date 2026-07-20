-- Misafir claim okuyucuları (JWT'ye 0012'de basılacak table_session_id
-- claim'ini okur) — table_sessions RLS'i bu migration'da bunlara ihtiyaç
-- duyduğu için helper'lar burada tanımlanır.
create or replace function public.current_table_session_id()
returns uuid
language sql
stable
as $$
  select nullif(auth.jwt() ->> 'table_session_id', '')::uuid
$$;

create or replace function public.current_guest_branch_id()
returns uuid
language sql
stable
as $$
  select nullif(auth.jwt() ->> 'branch_id', '')::uuid
$$;

create table public.tables (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  label text not null,
  qr_token_hash text not null unique, -- ham token asla saklanmaz, yalnız SHA-256 hash'i (RULES #7)
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index idx_tables_tenant_id on public.tables(tenant_id);
create index idx_tables_branch_id on public.tables(branch_id);
alter table public.tables enable row level security;
create policy "tables_staff_all" on public.tables for all
  using (tenant_id = public.current_tenant_id() and public.is_staff())
  with check (tenant_id = public.current_tenant_id() and public.is_staff());
grant select, insert, update, delete on public.tables to authenticated, service_role;

create table public.generic_qr_codes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  qr_token_hash text not null unique,
  label text not null default 'Genel QR',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index idx_generic_qr_codes_tenant_id on public.generic_qr_codes(tenant_id);
alter table public.generic_qr_codes enable row level security;
create policy "generic_qr_codes_staff_all" on public.generic_qr_codes for all
  using (tenant_id = public.current_tenant_id() and public.is_staff())
  with check (tenant_id = public.current_tenant_id() and public.is_staff());
grant select, insert, update, delete on public.generic_qr_codes to authenticated, service_role;

-- table_sessions / session_events / table_session_devices: RULES #5 — misafir
-- yazması yalnızca imzalı token doğrulayan RPC üzerinden olur (0013). Bu
-- yüzden "authenticated" rolüne (misafir dahil) yalnızca SELECT verilir,
-- INSERT/UPDATE/DELETE hiç grant edilmez — RPC'ler SECURITY DEFINER olarak
-- tablo sahibi (postgres) yetkisiyle çalışıp grant'lardan bağımsız yazar.
create table public.table_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  table_id uuid not null references public.tables(id) on delete restrict,
  status text not null default 'active' check (status in ('active', 'closed')),
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  close_reason text check (close_reason in ('payment', 'timeout', 'manual')), -- 'payment' şema-only: Faz 3
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create unique index idx_table_sessions_one_active_per_table
  on public.table_sessions (table_id) where status = 'active';
create index idx_table_sessions_tenant_id on public.table_sessions(tenant_id);
alter table public.table_sessions enable row level security;
create policy "table_sessions_select" on public.table_sessions for select
  using (
    (tenant_id = public.current_tenant_id() and public.is_staff())
    or id = public.current_table_session_id()
  );
grant select on public.table_sessions to authenticated, service_role;
grant insert, update, delete on public.table_sessions to service_role;

create table public.session_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  table_session_id uuid not null references public.table_sessions(id) on delete cascade,
  event_type text not null check (event_type in ('opened', 'table_moved', 'closed')),
  from_table_id uuid references public.tables(id),
  to_table_id uuid references public.tables(id),
  actor_profile_id uuid references public.profiles(id),
  reason text,
  created_at timestamptz not null default now()
);
create index idx_session_events_tenant_id on public.session_events(tenant_id);
create index idx_session_events_table_session_id on public.session_events(table_session_id);
alter table public.session_events enable row level security;
create policy "session_events_staff_select" on public.session_events for select
  using (tenant_id = public.current_tenant_id() and public.is_staff());
grant select on public.session_events to authenticated, service_role;
grant insert on public.session_events to service_role;

create table public.table_session_devices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  table_session_id uuid not null references public.table_sessions(id) on delete cascade,
  guest_user_id uuid not null unique references auth.users(id) on delete cascade,
  device_label text not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index idx_table_session_devices_tenant_id on public.table_session_devices(tenant_id);
create index idx_table_session_devices_session_id on public.table_session_devices(table_session_id);
alter table public.table_session_devices enable row level security;
create policy "table_session_devices_select" on public.table_session_devices for select
  using (
    (tenant_id = public.current_tenant_id() and public.is_staff())
    or guest_user_id = auth.uid()
  );
grant select on public.table_session_devices to authenticated, service_role;
grant insert, update on public.table_session_devices to service_role;
