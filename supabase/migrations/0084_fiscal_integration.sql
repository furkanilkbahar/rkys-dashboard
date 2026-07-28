-- Faz 17 Adım 0 (S67): ÖKC (mali yazarkasa) adaptör kapısı. ARCHITECTURE.md
-- D61 kararı başlangıçta yalnızca arayüz (implementasyon yok) öngörüyordu —
-- kullanıcı onayıyla (2026-07-28) payments/subscriptions ile aynı
-- mock-first desene genişletildi (bkz. DECISIONS.md D84).

alter table public.tenant_modules drop constraint tenant_modules_module_key_check;
alter table public.tenant_modules add constraint tenant_modules_module_key_check check (module_key in (
  'pos_cash', 'inventory', 'recipes', 'crm_loyalty', 'campaigns', 'gift_cards',
  'pickup', 'delivery', 'courier', 'marketplace', 'reservations', 'kiosk',
  'staff_scheduling', 'accounting_export', 'api_access', 'fiscal_integration'
));

alter table public.plan_modules drop constraint plan_modules_module_key_check;
alter table public.plan_modules add constraint plan_modules_module_key_check check (module_key in (
  'pos_cash', 'inventory', 'recipes', 'crm_loyalty', 'campaigns', 'gift_cards',
  'pickup', 'delivery', 'courier', 'marketplace', 'reservations', 'kiosk',
  'staff_scheduling', 'accounting_export', 'api_access', 'fiscal_integration'
));

alter table public.module_requests drop constraint module_requests_module_key_check;
alter table public.module_requests add constraint module_requests_module_key_check check (module_key in (
  'pos_cash', 'inventory', 'recipes', 'crm_loyalty', 'campaigns', 'gift_cards',
  'pickup', 'delivery', 'courier', 'marketplace', 'reservations', 'kiosk',
  'staff_scheduling', 'accounting_export', 'api_access', 'fiscal_integration'
));

alter table public.module_addon_prices drop constraint module_addon_prices_module_key_check;
alter table public.module_addon_prices add constraint module_addon_prices_module_key_check check (module_key in (
  'pos_cash', 'inventory', 'recipes', 'crm_loyalty', 'campaigns', 'gift_cards',
  'pickup', 'delivery', 'courier', 'marketplace', 'reservations', 'kiosk',
  'staff_scheduling', 'accounting_export', 'api_access', 'fiscal_integration'
));

-- fiscal_receipts: her tamamlanmış ödeme (payments, 0031) için kesilen
-- (şimdilik mock) ÖKC fişinin denetim izi — reason_codes (0031) ile aynı
-- desen: karmaşık iş kuralı olmadığı için doğrudan staff RLS'i, RPC yok.
create table public.fiscal_receipts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  payment_id uuid not null unique references public.payments(id) on delete cascade,
  provider text not null default 'mock',
  provider_ref text not null,
  status text not null default 'issued' check (status in ('issued', 'voided')),
  issued_at timestamptz not null default now(),
  voided_at timestamptz,
  created_by uuid references public.profiles(id)
);
create index idx_fiscal_receipts_tenant_id on public.fiscal_receipts(tenant_id);
alter table public.fiscal_receipts enable row level security;
create policy "fiscal_receipts_staff_all" on public.fiscal_receipts for all
  using (tenant_id = public.current_tenant_id() and public.is_staff())
  with check (tenant_id = public.current_tenant_id() and public.is_staff());
grant select, insert, update, delete on public.fiscal_receipts to authenticated, service_role;

-- get_fiscal_daily_summary: get_courier_daily_summary (0063) ile aynı desen
-- (tenant saat dilimine göre business_date).
create or replace function public.get_fiscal_daily_summary(p_business_date date)
returns table(receipt_count integer, total_amount_minor integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid := public.current_tenant_id();
  v_timezone text;
begin
  if not public.is_staff() then
    raise exception 'staff only';
  end if;
  select timezone into v_timezone from public.tenants where id = v_tenant_id;

  return query
  select count(*)::integer, coalesce(sum(p.amount_minor + p.tip_amount_minor), 0)::integer
  from public.fiscal_receipts fr
  join public.payments p on p.id = fr.payment_id
  where fr.tenant_id = v_tenant_id and fr.status = 'issued'
    and (fr.issued_at at time zone coalesce(v_timezone, 'UTC'))::date = p_business_date;
end;
$$;
revoke all on function public.get_fiscal_daily_summary(date) from public;
grant execute on function public.get_fiscal_daily_summary(date) to authenticated;

-- 'unlimited' planı tüm modülleri içerir (0073) — yeni modül eklendiğinde
-- bu planın kapsamına da eklenir.
insert into public.plan_modules (plan_id, module_key)
select p.id, 'fiscal_integration'
from public.plans p
where p.key = 'unlimited'
on conflict do nothing;
