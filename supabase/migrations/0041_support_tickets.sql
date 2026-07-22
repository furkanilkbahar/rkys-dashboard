-- Faz 4 Adım 5: destek ticket modülü (S15).

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  subject text not null,
  status text not null default 'open' check (status in ('open', 'answered', 'resolved')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_support_tickets_tenant_id on public.support_tickets(tenant_id);

alter table public.support_tickets enable row level security;

-- announcements (0037) ile aynı desen: tenant kendi ticket'ını tam yönetir,
-- platform_admin hepsine erişir — RPC katmanına gerek yok, invariant yok.
create policy "support_tickets_tenant_own"
  on public.support_tickets for all
  using (tenant_id = public.current_tenant_id() and public.is_staff())
  with check (tenant_id = public.current_tenant_id() and public.is_staff());

create policy "support_tickets_platform_admin_all"
  on public.support_tickets for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

grant select, insert, update, delete on public.support_tickets to authenticated, service_role;

create table public.ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  sender text not null check (sender in ('tenant', 'platform')),
  body text not null,
  created_at timestamptz not null default now()
);

create index idx_ticket_messages_ticket_id on public.ticket_messages(ticket_id);

alter table public.ticket_messages enable row level security;

create policy "ticket_messages_tenant_own"
  on public.ticket_messages for all
  using (tenant_id = public.current_tenant_id() and public.is_staff())
  with check (tenant_id = public.current_tenant_id() and public.is_staff());

create policy "ticket_messages_platform_admin_all"
  on public.ticket_messages for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

grant select, insert, update, delete on public.ticket_messages to authenticated, service_role;
