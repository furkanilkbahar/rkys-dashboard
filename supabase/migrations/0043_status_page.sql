-- Faz 4 Adım 7: status sayfası + uptime izleme (D72 sınırı: yalnızca veri
-- modeli + public sayfa + manuel incident girişi — gerçek 3.parti alerting
-- production'a geçilince aktifleşecek).
--
-- incidents, announcements'tan (0037) kasıtlı olarak ayrı: announcements =
-- planlı bakım/panel banner'ı, incidents = gerçekleşmiş kesinti geçmişi.
-- İkisi de public status sayfasında birleşik gösterilir.

create table public.incidents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  status text not null default 'investigating' check (status in ('investigating', 'identified', 'monitoring', 'resolved')),
  started_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.incidents enable row level security;

-- Herkese açık okunur (public /status sayfası) — plans/announcements ile
-- aynı desen.
create policy "incidents_select_all"
  on public.incidents for select
  using (true);

create policy "incidents_platform_admin_write"
  on public.incidents for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

grant select on public.incidents to anon, authenticated, service_role;
grant insert, update, delete on public.incidents to authenticated, service_role;

create table public.incident_updates (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index idx_incident_updates_incident_id on public.incident_updates(incident_id);

alter table public.incident_updates enable row level security;

create policy "incident_updates_select_all"
  on public.incident_updates for select
  using (true);

create policy "incident_updates_platform_admin_write"
  on public.incident_updates for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

grant select on public.incident_updates to anon, authenticated, service_role;
grant insert, update, delete on public.incident_updates to authenticated, service_role;
