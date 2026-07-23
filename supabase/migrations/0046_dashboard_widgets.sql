-- Faz 5 Adım 2: widget dashboard (sürükle-bırak) — sıralama/görünürlük
-- kullanıcı bazlı kişiselleştirilir (aynı tenant'ın iki personeli farklı
-- düzen görebilir). Sabit widget kataloğu TS tarafında tutulur
-- (src/lib/analytics/widgets.ts, MODULE_KEYS ile aynı desen); burada yalnızca
-- her kullanıcının kendi sırası/görünürlüğü saklanır.
create table public.dashboard_widgets (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  widget_key text not null,
  position integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, widget_key)
);
create index idx_dashboard_widgets_tenant_id on public.dashboard_widgets(tenant_id);
alter table public.dashboard_widgets enable row level security;
create policy "dashboard_widgets_own" on public.dashboard_widgets for all
  using (tenant_id = public.current_tenant_id() and user_id = auth.uid() and public.is_staff())
  with check (tenant_id = public.current_tenant_id() and user_id = auth.uid() and public.is_staff());
grant select, insert, update, delete on public.dashboard_widgets to authenticated, service_role;
