create table public.branches (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_branches_tenant_id on public.branches(tenant_id);

alter table public.branches enable row level security;

create policy "branches_tenant_isolation"
  on public.branches for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

grant select, insert, update, delete on public.branches to authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  role text not null check (role in ('owner', 'manager', 'waiter', 'kitchen', 'courier')),
  badge_no text,
  photo_url text,
  pin_hash text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index idx_profiles_tenant_id on public.profiles(tenant_id);

alter table public.profiles enable row level security;

create policy "profiles_tenant_select"
  on public.profiles for select
  using (tenant_id = public.current_tenant_id());

create policy "profiles_self_update"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

grant select, update on public.profiles to authenticated;

create table public.staff_branch_assignments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (profile_id, branch_id)
);

create index idx_staff_branch_assignments_tenant_id on public.staff_branch_assignments(tenant_id);

alter table public.staff_branch_assignments enable row level security;

create policy "staff_branch_assignments_tenant_isolation"
  on public.staff_branch_assignments for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

grant select, insert, update, delete on public.staff_branch_assignments to authenticated;
