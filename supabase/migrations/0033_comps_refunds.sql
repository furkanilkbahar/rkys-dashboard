-- content_translations.entity_type (0009) call_type'tan sonra genişletilmedi
-- — reason_code isimleri (comp/refund/cancel sebep kodları) için ekleniyor.
alter table public.content_translations drop constraint content_translations_entity_type_check;
alter table public.content_translations add constraint content_translations_entity_type_check
  check (entity_type in ('menu_category', 'product', 'product_variant', 'product_extra', 'call_type', 'reason_code'));

-- Faz 3 Adım 4: ikram/indirim (comp) + tam iade (refund).
-- comp: order hedefli, tutar sipariş subtotal'ını aşamaz, sebep kodu zorunlu
-- (RULES #35). refund: payment hedefli, yalnızca TAM iade (D44 — kalem/kısmi
-- iade Faz 6'nın ortak hesap-bölme altyapısıyla gelecek); online ödemeler
-- provider.refund() ile (app katmanında, bu RPC'den önce) iade edilir, kasa
-- ödemeleri (cash/card_manual) yalnızca manuel kayıt.

create table public.comps (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete restrict,
  amount_minor integer not null check (amount_minor > 0),
  reason_code_id uuid not null references public.reason_codes(id),
  note text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index idx_comps_tenant_id on public.comps(tenant_id);
create index idx_comps_order_id on public.comps(order_id);
alter table public.comps enable row level security;
create policy "comps_select" on public.comps for select
  using (tenant_id = public.current_tenant_id() and public.is_staff());
grant select on public.comps to authenticated;
grant select, insert, update, delete on public.comps to service_role;

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  payment_id uuid not null references public.payments(id) on delete restrict,
  amount_minor integer not null check (amount_minor > 0),
  reason_code_id uuid not null references public.reason_codes(id),
  provider_ref text,
  note text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (payment_id)
);
create index idx_refunds_tenant_id on public.refunds(tenant_id);
alter table public.refunds enable row level security;
create policy "refunds_select" on public.refunds for select
  using (tenant_id = public.current_tenant_id() and public.is_staff());
grant select on public.refunds to authenticated;
grant select, insert, update, delete on public.refunds to service_role;

-- record_comp: order_id hedefli ikram/indirim. comp_discount izin bayrağı
-- RPC içinde doğrulanır (RULES #41), sebep kodu zorunlu ve category='comp'
-- olmalı (RULES #35). Kümülatif comp, siparişin subtotal'ını aşamaz.
create or replace function public.record_comp(
  p_order_id uuid,
  p_amount_minor integer,
  p_reason_code_id uuid,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid := public.current_tenant_id();
  v_branch_id uuid;
  v_subtotal integer;
  v_status text;
  v_already_comped integer;
  v_reason_category text;
  v_comp_id uuid;
begin
  if not public.current_can('comp_discount') then
    raise exception 'forbidden';
  end if;
  if p_amount_minor <= 0 then
    raise exception 'invalid amount';
  end if;

  select branch_id, subtotal_minor, status into v_branch_id, v_subtotal, v_status
  from public.orders
  where id = p_order_id and tenant_id = v_tenant_id
  for update;
  if not found or v_status = 'cancelled' then
    raise exception 'order not eligible';
  end if;

  select category into v_reason_category from public.reason_codes
  where id = p_reason_code_id and tenant_id = v_tenant_id and is_active = true;
  if v_reason_category is distinct from 'comp' then
    raise exception 'invalid reason code';
  end if;

  select coalesce(sum(amount_minor), 0) into v_already_comped
  from public.comps where order_id = p_order_id;
  if v_already_comped + p_amount_minor > v_subtotal then
    raise exception 'amount exceeds order subtotal';
  end if;

  insert into public.comps (tenant_id, branch_id, order_id, amount_minor, reason_code_id, note, created_by)
  values (v_tenant_id, v_branch_id, p_order_id, p_amount_minor, p_reason_code_id, p_note, auth.uid())
  returning id into v_comp_id;

  return v_comp_id;
end;
$$;
revoke all on function public.record_comp(uuid, integer, uuid, text) from public;
grant execute on function public.record_comp(uuid, integer, uuid, text) to authenticated;

-- record_refund: payment_id hedefli TAM iade. Tutar payment'ın kendi
-- amount+tip toplamından otomatik hesaplanır, client tarafından verilemez
-- (kısmi iade riskini RPC seviyesinde eler). p_provider_ref, online
-- ödemeler için app katmanının provider.refund() çağrısından dönen kanıtı
-- taşır — kasa ödemelerinde null kalır.
create or replace function public.record_refund(
  p_payment_id uuid,
  p_reason_code_id uuid,
  p_note text default null,
  p_provider_ref text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid := public.current_tenant_id();
  v_branch_id uuid;
  v_method text;
  v_status text;
  v_shift_id uuid;
  v_amount integer;
  v_reason_category text;
  v_refund_id uuid;
begin
  if not public.current_can('refund') then
    raise exception 'forbidden';
  end if;

  select branch_id, method, status, amount_minor + tip_amount_minor
  into v_branch_id, v_method, v_status, v_amount
  from public.payments
  where id = p_payment_id and tenant_id = v_tenant_id
  for update;
  if not found or v_status <> 'completed' then
    raise exception 'payment not refundable';
  end if;

  select category into v_reason_category from public.reason_codes
  where id = p_reason_code_id and tenant_id = v_tenant_id and is_active = true;
  if v_reason_category is distinct from 'refund' then
    raise exception 'invalid reason code';
  end if;

  insert into public.refunds (tenant_id, branch_id, payment_id, amount_minor, reason_code_id, provider_ref, note, created_by)
  values (v_tenant_id, v_branch_id, p_payment_id, v_amount, p_reason_code_id, p_provider_ref, p_note, auth.uid())
  returning id into v_refund_id;

  update public.payments set status = 'refunded' where id = p_payment_id;

  if v_method = 'cash' then
    select id into v_shift_id from public.cash_shifts
    where branch_id = v_branch_id and status = 'open';
    if v_shift_id is not null then
      insert into public.cash_movements (tenant_id, branch_id, cash_shift_id, movement_type, amount_minor, note, created_by)
      values (v_tenant_id, v_branch_id, v_shift_id, 'refund', v_amount, 'refund:' || v_refund_id, auth.uid());
    end if;
  end if;

  return v_refund_id;
end;
$$;
revoke all on function public.record_refund(uuid, uuid, text, text) from public;
grant execute on function public.record_refund(uuid, uuid, text, text) to authenticated;

-- record_payment (0031): comp'lu siparişlerde "tam ödendi" eşiği artık
-- oturumun sipariş subtotal toplamından o oturuma ait comp toplamı
-- düşülerek hesaplanır — aksi halde ikram uygulanan bir oturum asla
-- kapanamazdı.
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
  v_session_comped integer;
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

  select coalesce(sum(o.subtotal_minor), 0) into v_session_subtotal
  from public.orders o
  where o.table_session_id = p_table_session_id and o.status <> 'cancelled';

  select coalesce(sum(c.amount_minor), 0) into v_session_comped
  from public.comps c
  join public.orders o on o.id = c.order_id
  where o.table_session_id = p_table_session_id;

  select coalesce(sum(amount_minor), 0) into v_already_paid
  from public.payments
  where table_session_id = p_table_session_id and status = 'completed';

  if v_already_paid >= v_session_subtotal - v_session_comped then
    update public.table_sessions
    set status = 'closed', closed_at = now(), close_reason = 'payment'
    where id = p_table_session_id;

    insert into public.session_events (tenant_id, branch_id, table_session_id, event_type, actor_profile_id, reason)
    values (v_tenant_id, v_branch_id, p_table_session_id, 'closed', auth.uid(), 'payment');
  end if;

  return v_payment_id;
end;
$$;
