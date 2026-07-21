-- Faz 3 Adım 2: ödeme alma (nakit/manuel kart, eşit bölüşme, bahşiş) +
-- sebep kodları (comps/refunds Adım 4'te bu tabloyu referans alacak).

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  table_session_id uuid not null references public.table_sessions(id) on delete restrict,
  method text not null check (method in ('cash', 'card_manual', 'online')),
  provider text not null default 'manual' check (provider in ('manual', 'mock', 'iyzico')),
  provider_ref text,
  amount_minor integer not null check (amount_minor > 0),
  tip_amount_minor integer not null default 0 check (tip_amount_minor >= 0),
  split_group uuid,
  status text not null default 'completed' check (status in ('pending', 'completed', 'failed', 'refunded')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index idx_payments_tenant_id on public.payments(tenant_id);
create index idx_payments_table_session_id on public.payments(table_session_id);
alter table public.payments enable row level security;
create policy "payments_select" on public.payments for select
  using (tenant_id = public.current_tenant_id() and public.is_staff());
grant select on public.payments to authenticated;
grant select, insert, update, delete on public.payments to service_role;

-- call_types ile aynı desen (lookup tablo + content_translations, entity_type='reason_code').
create table public.reason_codes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  category text not null check (category in ('comp', 'refund', 'cancel')),
  key text not null,
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (tenant_id, category, key)
);
create index idx_reason_codes_tenant_id on public.reason_codes(tenant_id);
alter table public.reason_codes enable row level security;
create policy "reason_codes_select" on public.reason_codes for select
  using (tenant_id = public.current_tenant_id() and public.is_staff());
create policy "reason_codes_staff_write" on public.reason_codes for all
  using (tenant_id = public.current_tenant_id() and public.is_staff())
  with check (tenant_id = public.current_tenant_id() and public.is_staff());
grant select, insert, update, delete on public.reason_codes to authenticated, service_role;

-- record_payment: tam veya split_group ile parçalı-eşit ödeme kaydı. Nakit
-- ödemeler açık vardiyanın kasa hareketine ('sale') yazılır (kart manuel
-- ödemeler banka hesabına gittiği için kasa nakdini etkilemez). Oturumun
-- tüm sipariş toplamı karşılanınca table_sessions doğrudan kapatılır —
-- close_table_session RPC'si (0018) yalnızca 'manual' sebebini kabul ediyor
-- ve Faz 1'in test edilmiş akışına dokunmamak için burada tekrar edilmiyor,
-- aynı kapatma mantığı (status/closed_at/close_reason + session_events)
-- 'payment' sebebiyle dahili olarak uygulanıyor.
create or replace function public.record_payment(
  p_table_session_id uuid,
  p_method text,
  p_amount_minor integer,
  p_tip_amount_minor integer default 0,
  p_split_group uuid default null
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
  v_shift_id uuid;
  v_session_subtotal integer;
  v_already_paid integer;
begin
  if not public.is_staff() then
    raise exception 'staff only';
  end if;
  if p_method not in ('cash', 'card_manual') then
    raise exception 'invalid method';
  end if;
  if p_amount_minor <= 0 then
    raise exception 'invalid amount';
  end if;

  select branch_id, status into v_branch_id, v_status
  from public.table_sessions
  where id = p_table_session_id and tenant_id = v_tenant_id
  for update;
  if not found or v_status <> 'active' then
    raise exception 'table session is not active';
  end if;

  insert into public.payments
    (tenant_id, branch_id, table_session_id, method, provider, amount_minor, tip_amount_minor, split_group, status, created_by)
  values
    (v_tenant_id, v_branch_id, p_table_session_id, p_method, 'manual', p_amount_minor, p_tip_amount_minor, p_split_group, 'completed', auth.uid())
  returning id into v_payment_id;

  if p_method = 'cash' then
    select id into v_shift_id from public.cash_shifts
    where branch_id = v_branch_id and status = 'open';
    if v_shift_id is not null then
      insert into public.cash_movements (tenant_id, branch_id, cash_shift_id, movement_type, amount_minor, note, created_by)
      values (v_tenant_id, v_branch_id, v_shift_id, 'sale', p_amount_minor + p_tip_amount_minor, 'payment:' || v_payment_id, auth.uid());
    end if;
  end if;

  select coalesce(sum(subtotal_minor), 0) into v_session_subtotal
  from public.orders
  where table_session_id = p_table_session_id and status <> 'cancelled';

  select coalesce(sum(amount_minor), 0) into v_already_paid
  from public.payments
  where table_session_id = p_table_session_id and status = 'completed';

  if v_already_paid >= v_session_subtotal then
    update public.table_sessions
    set status = 'closed', closed_at = now(), close_reason = 'payment'
    where id = p_table_session_id;

    insert into public.session_events (tenant_id, branch_id, table_session_id, event_type, actor_profile_id, reason)
    values (v_tenant_id, v_branch_id, p_table_session_id, 'closed', auth.uid(), 'payment');
  end if;

  return v_payment_id;
end;
$$;
revoke all on function public.record_payment(uuid, text, integer, integer, uuid) from public;
grant execute on function public.record_payment(uuid, text, integer, integer, uuid) to authenticated;
