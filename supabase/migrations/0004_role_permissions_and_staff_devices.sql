create table public.role_permissions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  role text not null check (role in ('owner', 'manager', 'waiter', 'kitchen', 'courier')),
  permission_key text not null,
  allowed boolean not null default false,
  created_at timestamptz not null default now(),
  unique (tenant_id, role, permission_key)
);

create index idx_role_permissions_tenant_id on public.role_permissions(tenant_id);

alter table public.role_permissions enable row level security;

create policy "role_permissions_tenant_isolation"
  on public.role_permissions for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

grant select, insert, update, delete on public.role_permissions to authenticated;

-- PIN'ler düz metin saklanmaz (RULES #29) — device_secret_hash bir hash'tir.
create table public.staff_devices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  device_label text not null,
  device_secret_hash text not null,
  is_active boolean not null default true,
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_staff_devices_tenant_id on public.staff_devices(tenant_id);

alter table public.staff_devices enable row level security;

create policy "staff_devices_tenant_isolation"
  on public.staff_devices for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

grant select, insert, update, delete on public.staff_devices to authenticated;
