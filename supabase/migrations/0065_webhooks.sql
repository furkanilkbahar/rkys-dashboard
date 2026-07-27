-- Faz 10 Adım 1 (S42): imzalı, retry'lı webhook'lar (D62/ARCHITECTURE #72).
--
-- Teslimat iki aşamalı, pg_net'in ASENKRON doğası yüzünden (net.http_post
-- hemen bir request_id döner, gerçek cevap net._http_response'a sonradan
-- düşer — bkz. trigger_scheduled_reports_digest, 0048, aynı pg_net'i
-- fire-and-forget kullanıyor ama cevabı hiç kontrol etmiyordu; webhook'larda
-- "başarısızsa retry" gerektiği için burada cevap GERÇEKTEN kontrol edilir):
--   1. dispatch_webhook_deliveries (cron, dakikada bir): 'pending' + zamanı
--      gelmiş teslimatlar için HMAC-SHA256 imzalar, net.http_post ile POST
--      atar, 'sent' + pg_net_request_id olarak işaretler.
--   2. reconcile_webhook_deliveries (cron, dakikada bir): 'sent' olup cevabı
--      net._http_response'a düşmüş teslimatları kontrol eder — 2xx ise
--      'delivered', değilse üstel geri çekilmeli (2^attempt dakika) yeniden
--      'pending'e döner (5 denemeden sonra kalıcı 'failed').
-- Olay üretimi: orders tablosuna trigger (RPC'lere tek tek dokunmadan tüm
-- sipariş mutasyonları otomatik yakalanır).

create extension if not exists pg_net;

create table public.webhooks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  url text not null,
  secret text not null,
  event_types text[] not null check (array_length(event_types, 1) > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index idx_webhooks_tenant_id on public.webhooks(tenant_id);
alter table public.webhooks enable row level security;
create policy "webhooks_select" on public.webhooks for select
  using (tenant_id = public.current_tenant_id() and public.is_staff());
create policy "webhooks_staff_write" on public.webhooks for all
  using (tenant_id = public.current_tenant_id() and public.is_staff())
  with check (tenant_id = public.current_tenant_id() and public.is_staff());
grant select, insert, update, delete on public.webhooks to authenticated;
grant all on public.webhooks to service_role;

create table public.webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  webhook_id uuid not null references public.webhooks(id) on delete cascade,
  event_type text not null,
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'delivered', 'failed')),
  attempt_count integer not null default 0,
  next_retry_at timestamptz not null default now(),
  pg_net_request_id bigint,
  delivered_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_webhook_deliveries_tenant_id on public.webhook_deliveries(tenant_id);
create index idx_webhook_deliveries_dispatch on public.webhook_deliveries(status, next_retry_at) where status = 'pending';
alter table public.webhook_deliveries enable row level security;
create policy "webhook_deliveries_select" on public.webhook_deliveries for select
  using (tenant_id = public.current_tenant_id() and public.is_staff());
grant select on public.webhook_deliveries to authenticated;
grant all on public.webhook_deliveries to service_role;

create or replace function public.enqueue_webhook_event(p_tenant_id uuid, p_event_type text, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_webhook record;
begin
  if not exists (
    select 1 from public.tenant_modules where tenant_id = p_tenant_id and module_key = 'api_access' and is_enabled = true
  ) then
    return;
  end if;

  for v_webhook in
    select id from public.webhooks
    where tenant_id = p_tenant_id and is_active = true and p_event_type = any(event_types)
  loop
    insert into public.webhook_deliveries (tenant_id, webhook_id, event_type, payload)
    values (p_tenant_id, v_webhook.id, p_event_type, p_payload);
  end loop;
end;
$$;
revoke all on function public.enqueue_webhook_event(uuid, text, jsonb) from public;
grant execute on function public.enqueue_webhook_event(uuid, text, jsonb) to service_role;

create or replace function public.trg_enqueue_order_webhook()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    perform public.enqueue_webhook_event(
      new.tenant_id, 'order.created',
      jsonb_build_object('order_id', new.id, 'channel', new.channel, 'status', new.status, 'subtotal_minor', new.subtotal_minor)
    );
  elsif TG_OP = 'UPDATE' and new.status is distinct from old.status then
    perform public.enqueue_webhook_event(
      new.tenant_id, 'order.status_changed',
      jsonb_build_object('order_id', new.id, 'channel', new.channel, 'status', new.status, 'previous_status', old.status)
    );
  end if;
  return new;
end;
$$;

create trigger trg_orders_webhook_events
after insert or update on public.orders
for each row execute function public.trg_enqueue_order_webhook();

-- search_path'e "extensions" eklenir: pgcrypto (hmac) buraya kurulu
-- (bkz. supabase/config.toml extra_search_path), diğer SECURITY DEFINER
-- fonksiyonlarının kullandığı gen_random_uuid()/gen_random_bytes() artık
-- çekirdek Postgres'te olduğu için bu ihtiyaç şimdiye kadar hiç çıkmamıştı.
create or replace function public.dispatch_webhook_deliveries()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_delivery record;
  v_webhook public.webhooks;
  v_signature text;
  v_request_id bigint;
begin
  for v_delivery in
    select * from public.webhook_deliveries
    where status = 'pending' and next_retry_at <= now()
    order by created_at
    limit 50
    for update skip locked
  loop
    select * into v_webhook from public.webhooks where id = v_delivery.webhook_id and is_active = true;
    if v_webhook.id is null then
      update public.webhook_deliveries set status = 'failed' where id = v_delivery.id;
      continue;
    end if;

    v_signature := encode(hmac(v_delivery.payload::text, v_webhook.secret, 'sha256'), 'hex');
    select net.http_post(
      url := v_webhook.url,
      headers := jsonb_build_object('Content-Type', 'application/json', 'X-RKYS-Signature', v_signature, 'X-RKYS-Event', v_delivery.event_type),
      body := v_delivery.payload
    ) into v_request_id;

    update public.webhook_deliveries
    set status = 'sent', attempt_count = attempt_count + 1, pg_net_request_id = v_request_id
    where id = v_delivery.id;
  end loop;
end;
$$;
revoke all on function public.dispatch_webhook_deliveries() from public, authenticated, anon;
grant execute on function public.dispatch_webhook_deliveries() to service_role;

create or replace function public.reconcile_webhook_deliveries()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_delivery record;
  v_response net._http_response;
  v_backoff_minutes integer;
begin
  for v_delivery in
    select * from public.webhook_deliveries where status = 'sent' and pg_net_request_id is not null
    for update skip locked
  loop
    select * into v_response from net._http_response where id = v_delivery.pg_net_request_id;
    if v_response.id is null then
      continue;
    end if;

    if v_response.status_code between 200 and 299 then
      update public.webhook_deliveries set status = 'delivered', delivered_at = now() where id = v_delivery.id;
    elsif v_delivery.attempt_count >= 5 then
      update public.webhook_deliveries set status = 'failed' where id = v_delivery.id;
    else
      v_backoff_minutes := 2 ^ v_delivery.attempt_count;
      update public.webhook_deliveries
      set status = 'pending', next_retry_at = now() + (v_backoff_minutes || ' minutes')::interval
      where id = v_delivery.id;
    end if;
  end loop;
end;
$$;
revoke all on function public.reconcile_webhook_deliveries() from public, authenticated, anon;
grant execute on function public.reconcile_webhook_deliveries() to service_role;

select cron.schedule('dispatch-webhook-deliveries', '* * * * *', $$select public.dispatch_webhook_deliveries()$$);
select cron.schedule('reconcile-webhook-deliveries', '* * * * *', $$select public.reconcile_webhook_deliveries()$$);
