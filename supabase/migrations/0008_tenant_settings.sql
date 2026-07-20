-- D10: sipariş modu tenant ayarlı (direct/approval). Ayarlar admin UI'ı
-- Faz 2'de gelir (PLAN.md "şema kapısı" ilkesi) — şimdilik yalnızca şema +
-- RPC/seed üzerinden değiştirilebilir.
create table public.tenant_settings (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  order_mode text not null default 'direct' check (order_mode in ('direct', 'approval')),
  session_timeout_minutes integer not null default 180 check (session_timeout_minutes > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tenant_settings enable row level security;

create policy "tenant_settings_select"
  on public.tenant_settings for select
  using (tenant_id = public.current_tenant_id());

create policy "tenant_settings_staff_update"
  on public.tenant_settings for update
  using (tenant_id = public.current_tenant_id() and public.is_staff())
  with check (tenant_id = public.current_tenant_id() and public.is_staff());

grant select, update on public.tenant_settings to authenticated, service_role;
grant insert on public.tenant_settings to service_role;

create or replace function public.create_default_tenant_settings()
returns trigger
language plpgsql
as $$
begin
  insert into public.tenant_settings (tenant_id) values (new.id);
  return new;
end;
$$;

create trigger trg_tenants_create_settings
  after insert on public.tenants
  for each row execute function public.create_default_tenant_settings();

-- Backfill: mevcut seed tenant'ları (acme/beta) için de satır oluşur.
insert into public.tenant_settings (tenant_id)
select id from public.tenants
on conflict (tenant_id) do nothing;
