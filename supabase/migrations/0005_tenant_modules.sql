-- Modül anahtarı text + CHECK constraint olarak tutulur (enum değil): yeni
-- modül eklemek tek migration'da constraint güncellemesi ile yapılabilir,
-- Postgres enum'larının "add value" kısıtlarıyla uğraşılmaz.
create table public.tenant_modules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  module_key text not null check (module_key in (
    'pos_cash', 'inventory', 'recipes', 'crm_loyalty', 'campaigns', 'gift_cards',
    'pickup', 'delivery', 'courier', 'marketplace', 'reservations', 'kiosk',
    'staff_scheduling', 'accounting_export', 'api_access'
  )),
  is_enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (tenant_id, module_key)
);

create index idx_tenant_modules_tenant_id on public.tenant_modules(tenant_id);

alter table public.tenant_modules enable row level security;

create policy "tenant_modules_tenant_isolation"
  on public.tenant_modules for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

grant select, insert, update, delete on public.tenant_modules to authenticated, service_role;
