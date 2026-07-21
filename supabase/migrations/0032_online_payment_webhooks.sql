-- Faz 3 Adım 3: online ödeme (sağlayıcı-agnostik arayüz + mock + iyzico
-- iskeleti). payments.provider_ref zaten 0031'de vardı — burada webhook
-- idempotency'si için benzersizlik + checkout başlatma/tamamlama RPC'leri
-- eklenir. Bu iki RPC service_role tarafından çağrılır (webhook route
-- handler'ının kendisi kimliksiz — sağlayıcı çağırıyor, kullanıcı JWT'si
-- yok) — bu yüzden diğer RPC'lerin aksine yetki kontrolü is_staff() değil,
-- yalnızca service_role grant'i ile sağlanıyor.

create unique index idx_payments_provider_ref
  on public.payments (provider_ref) where provider_ref is not null;

-- Checkout başlatılırken 'pending' bir payments satırı açılır — webhook
-- geldiğinde provider_ref ile bulunup 'completed'e çevrilir.
create or replace function public.create_pending_online_payment(
  p_table_session_id uuid,
  p_amount_minor integer,
  p_tip_amount_minor integer,
  p_provider text,
  p_provider_ref text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid := public.current_tenant_id();
  v_branch_id uuid;
  v_status text;
  v_payment_id uuid;
begin
  -- Misafir kendi oturumunun ödemesini başlatabilir, personel de (kasadan
  -- online ödeme linki oluşturma senaryosu) — ya current_table_session_id()
  -- (guest JWT claim'i) ya da personel + tenant eşleşmesi geçerli olmalı.
  if public.current_role() = 'guest' then
    if public.current_table_session_id() is distinct from p_table_session_id then
      raise exception 'forbidden';
    end if;
  elsif not public.is_staff() then
    raise exception 'forbidden';
  end if;

  select branch_id, status into v_branch_id, v_status
  from public.table_sessions
  where id = p_table_session_id and tenant_id = v_tenant_id
  for update;
  if not found or v_status <> 'active' then
    raise exception 'table session is not active';
  end if;

  if p_amount_minor <= 0 then
    raise exception 'invalid amount';
  end if;

  insert into public.payments
    (tenant_id, branch_id, table_session_id, method, provider, provider_ref, amount_minor, tip_amount_minor, status)
  values
    (v_tenant_id, v_branch_id, p_table_session_id, 'online', p_provider, p_provider_ref, p_amount_minor, p_tip_amount_minor, 'pending')
  returning id into v_payment_id;

  return v_payment_id;
end;
$$;
revoke all on function public.create_pending_online_payment(uuid, integer, integer, text, text) from public;
grant execute on function public.create_pending_online_payment(uuid, integer, integer, text, text) to authenticated;

-- Yalnızca webhook route handler'ı (service_role) çağırır. İkinci kez aynı
-- provider_ref ile gelen bir webhook (retry/duplicate delivery) no-op'tur —
-- idempotency, RULES #31'in sipariş tarafındaki idempotency_key ilkesiyle aynı.
create or replace function public.complete_online_payment(p_provider text, p_provider_ref text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment record;
  v_session_subtotal integer;
  v_already_paid integer;
begin
  select id, tenant_id, branch_id, table_session_id, amount_minor, status
    into v_payment
  from public.payments
  where provider = p_provider and provider_ref = p_provider_ref
  for update;

  if not found then
    raise exception 'unknown payment';
  end if;

  if v_payment.status = 'completed' then
    return; -- idempotent: zaten işlenmiş
  end if;
  if v_payment.status <> 'pending' then
    raise exception 'payment is not pending';
  end if;

  update public.payments set status = 'completed' where id = v_payment.id;

  select coalesce(sum(subtotal_minor), 0) into v_session_subtotal
  from public.orders
  where table_session_id = v_payment.table_session_id and status <> 'cancelled';

  select coalesce(sum(amount_minor), 0) into v_already_paid
  from public.payments
  where table_session_id = v_payment.table_session_id and status = 'completed';

  if v_already_paid >= v_session_subtotal then
    update public.table_sessions
    set status = 'closed', closed_at = now(), close_reason = 'payment'
    where id = v_payment.table_session_id and status = 'active';

    insert into public.session_events (tenant_id, branch_id, table_session_id, event_type, reason)
    values (v_payment.tenant_id, v_payment.branch_id, v_payment.table_session_id, 'closed', 'payment');
  end if;
end;
$$;
revoke all on function public.complete_online_payment(text, text) from public;
grant execute on function public.complete_online_payment(text, text) to service_role;
