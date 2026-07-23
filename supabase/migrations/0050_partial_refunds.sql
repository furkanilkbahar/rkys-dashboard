-- Faz 6 Adım 1: kısmi/kalem iade (S26, ortak altyapı — D44).
-- refund_item_allocations bir iadenin hangi sipariş kalemini ne kadar
-- kapsadığını izler (payment_item_allocations'ın iade tarafındaki eşleniği).
-- RULES #18 immutability: var olan payments/refunds/allocations satırları
-- hiç değişmez — her yeni (kısmi) iade YENİ bir refunds satırıdır.

alter table public.refunds drop constraint refunds_payment_id_key;

create table public.refund_item_allocations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  refund_id uuid not null references public.refunds(id) on delete cascade,
  order_item_id uuid not null references public.order_items(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  amount_minor integer not null check (amount_minor > 0),
  created_at timestamptz not null default now()
);
create index idx_refund_item_allocations_tenant_id on public.refund_item_allocations(tenant_id);
create index idx_refund_item_allocations_refund_id on public.refund_item_allocations(refund_id);
alter table public.refund_item_allocations enable row level security;
create policy "refund_item_allocations_select" on public.refund_item_allocations for select
  using (tenant_id = public.current_tenant_id() and public.is_staff());
grant select on public.refund_item_allocations to authenticated;
grant select, insert, update, delete on public.refund_item_allocations to service_role;

-- Kısmi iadeden sonra ödeme "completed" değil ama "refunded" da değil (hâlâ
-- kısmen tahsilatlı) — yeni bir ara statü.
alter table public.payments drop constraint payments_status_check;
alter table public.payments add constraint payments_status_check
  check (status in ('pending', 'completed', 'failed', 'refunded', 'partially_refunded'));

-- record_refund imzası değişiyor (tutar artık zımni değil, client belirtir;
-- ayrıca opsiyonel kalem allocation'ı) — Faz 5/6'daki aynı gerekçeyle önce
-- eski imza düşürülür.
drop function if exists public.record_refund(uuid, uuid, text, text);

-- record_refund: TAM veya KISMİ iade. Tutar artık p_amount_minor ile
-- belirtilir (önceden payment'ın tam tutarı zımnen kullanılıyordu);
-- kümülatif iade (bu + önceki iadeler) payment'ın amount+tip toplamını
-- aşamaz. p_item_allocations verilirse, yalnızca bu ÖDEMEYE ait
-- payment_item_allocations'tan (ve o kalemin bu ödemedeki daha önce iade
-- edilmemiş kalan miktarından) düşülebilir.
create or replace function public.record_refund(
  p_payment_id uuid,
  p_amount_minor integer,
  p_reason_code_id uuid,
  p_note text default null,
  p_provider_ref text default null,
  p_item_allocations jsonb default null
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
  v_payment_total integer;
  v_already_refunded integer;
  v_reason_category text;
  v_refund_id uuid;
  v_new_status text;
  v_allocation_total integer;
begin
  if not public.current_can('refund') then
    raise exception 'forbidden';
  end if;
  if p_amount_minor <= 0 then
    raise exception 'invalid amount';
  end if;

  select branch_id, method, status, amount_minor + tip_amount_minor
  into v_branch_id, v_method, v_status, v_payment_total
  from public.payments
  where id = p_payment_id and tenant_id = v_tenant_id
  for update;
  if not found or v_status not in ('completed', 'partially_refunded') then
    raise exception 'payment not refundable';
  end if;

  select coalesce(sum(amount_minor), 0) into v_already_refunded
  from public.refunds
  where payment_id = p_payment_id;
  if v_already_refunded + p_amount_minor > v_payment_total then
    raise exception 'refund amount exceeds remaining payment balance';
  end if;

  select category into v_reason_category from public.reason_codes
  where id = p_reason_code_id and tenant_id = v_tenant_id and is_active = true;
  if v_reason_category is distinct from 'refund' then
    raise exception 'invalid reason code';
  end if;

  if p_item_allocations is not null then
    select coalesce(sum((elem->>'amountMinor')::integer), 0) into v_allocation_total
    from jsonb_array_elements(p_item_allocations) elem;
    if v_allocation_total <> p_amount_minor then
      raise exception 'item allocations do not match amount';
    end if;

    -- Yalnızca BU ödemeye ait allocation'lardan, o kalemin bu ödemede daha
    -- önce iade edilmemiş kalan miktarı kadar iade edilebilir.
    if exists (
      select 1
      from (
        select (elem->>'orderItemId')::uuid as order_item_id, sum((elem->>'quantity')::integer) as requested_quantity
        from jsonb_array_elements(p_item_allocations) elem
        group by (elem->>'orderItemId')::uuid
      ) req
      left join (
        select pia.order_item_id, sum(pia.quantity) as paid_quantity
        from public.payment_item_allocations pia
        where pia.payment_id = p_payment_id
        group by pia.order_item_id
      ) paid on paid.order_item_id = req.order_item_id
      left join (
        select ria.order_item_id, sum(ria.quantity) as refunded_quantity
        from public.refund_item_allocations ria
        join public.refunds r on r.id = ria.refund_id
        where r.payment_id = p_payment_id
        group by ria.order_item_id
      ) refunded on refunded.order_item_id = req.order_item_id
      where req.requested_quantity > coalesce(paid.paid_quantity, 0) - coalesce(refunded.refunded_quantity, 0)
    ) then
      raise exception 'item refund exceeds paid quantity';
    end if;
  end if;

  insert into public.refunds (tenant_id, branch_id, payment_id, amount_minor, reason_code_id, provider_ref, note, created_by)
  values (v_tenant_id, v_branch_id, p_payment_id, p_amount_minor, p_reason_code_id, p_provider_ref, p_note, auth.uid())
  returning id into v_refund_id;

  if p_item_allocations is not null then
    insert into public.refund_item_allocations (tenant_id, branch_id, refund_id, order_item_id, quantity, amount_minor)
    select v_tenant_id, v_branch_id, v_refund_id, (elem->>'orderItemId')::uuid, (elem->>'quantity')::integer, (elem->>'amountMinor')::integer
    from jsonb_array_elements(p_item_allocations) elem;
  end if;

  v_new_status := case when v_already_refunded + p_amount_minor >= v_payment_total then 'refunded' else 'partially_refunded' end;
  update public.payments set status = v_new_status where id = p_payment_id;

  if v_method = 'cash' then
    select id into v_shift_id from public.cash_shifts
    where branch_id = v_branch_id and status = 'open';
    if v_shift_id is not null then
      insert into public.cash_movements (tenant_id, branch_id, cash_shift_id, movement_type, amount_minor, note, created_by)
      values (v_tenant_id, v_branch_id, v_shift_id, 'refund', p_amount_minor, 'refund:' || v_refund_id, auth.uid());
    end if;
  end if;

  return v_refund_id;
end;
$$;
revoke all on function public.record_refund(uuid, integer, uuid, text, text, jsonb) from public;
grant execute on function public.record_refund(uuid, integer, uuid, text, text, jsonb) to authenticated;
