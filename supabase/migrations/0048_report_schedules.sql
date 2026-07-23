-- Faz 5 Adım 4: zamanlanmış e-posta/PDF raporları (S24).
-- report_schedules: reason_codes (0031) ile aynı desen — RPC katmanı yok,
-- doğrudan tablo CRUD'u (staff-only RLS), çünkü basit bir tenant kaynağı,
-- invariant yok. sent_emails: mock e-posta sağlayıcısının (lib/email/mock.ts)
-- gerçekten göndermek yerine yazdığı log — select-only RLS, insert yalnızca
-- service_role (mock.ts service-role client kullanır).

create table public.report_schedules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  frequency text not null check (frequency in ('daily', 'weekly')),
  recipient_email text not null,
  is_active boolean not null default true,
  last_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_report_schedules_tenant_id on public.report_schedules(tenant_id);
alter table public.report_schedules enable row level security;
create policy "report_schedules_select" on public.report_schedules for select
  using (tenant_id = public.current_tenant_id() and public.is_staff());
create policy "report_schedules_staff_write" on public.report_schedules for all
  using (tenant_id = public.current_tenant_id() and public.is_staff())
  with check (tenant_id = public.current_tenant_id() and public.is_staff());
grant select, insert, update, delete on public.report_schedules to authenticated;
grant select, insert, update, delete on public.report_schedules to service_role;

create table public.sent_emails (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  to_email text not null,
  subject text not null,
  provider text not null,
  has_attachment boolean not null default false,
  created_at timestamptz not null default now()
);
create index idx_sent_emails_tenant_id on public.sent_emails(tenant_id);
alter table public.sent_emails enable row level security;
create policy "sent_emails_select" on public.sent_emails for select
  using (tenant_id = public.current_tenant_id() and public.is_staff());
grant select on public.sent_emails to authenticated;
grant select, insert, update, delete on public.sent_emails to service_role;

-- trigger_scheduled_reports_digest: pg_net ile Next.js'in internal API
-- route'una (PDF üretimi + e-posta gönderimi Node tarafında, SQL bunu
-- yapamaz) fire-and-forget POST atar. app.internal_api_base_url/
-- app.internal_api_secret ayarlanmamışsa lokal geliştirme varsayılanına
-- düşer — staging/prod açıldığında (D72) `alter database postgres set
-- app.internal_api_base_url = '...'` ile gerçek değerler verilecek.
create or replace function public.trigger_scheduled_reports_digest()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base_url text := coalesce(current_setting('app.internal_api_base_url', true), 'http://host.docker.internal:3000');
  v_secret text := coalesce(current_setting('app.internal_api_secret', true), 'b6cec1d635209cb6f560d0943fb3107dc0ed67f138c02cfdc018c386509220b4');
begin
  perform net.http_post(
    url := v_base_url || '/api/internal/scheduled-reports',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-internal-secret', v_secret),
    body := '{}'::jsonb
  );
end;
$$;
revoke all on function public.trigger_scheduled_reports_digest() from public, authenticated, anon;
grant execute on function public.trigger_scheduled_reports_digest() to service_role;

select cron.schedule(
  'scheduled-reports-digest',
  '0 4 * * *',
  $$select public.trigger_scheduled_reports_digest()$$
);
