-- Faz 3 Adım 0: kasa vardiyası temeli + POS-lite'ın tezgâh (walk-in/telefon)
-- satışları için kullanacağı sanal masa.

alter table public.tables add column is_counter boolean not null default false;

-- Her şube otomatik bir "Tezgâh" masasıyla açılır (tenant_settings/
-- rating_settings'teki auto-create trigger deseniyle aynı, bkz. 0008/0027).
-- qr_token_hash NOT NULL UNIQUE olduğu için gerçekte hiç okutulmayacak bu
-- masaya da rastgele bir hash üretilir (RULES #7: tahmin edilebilir değer
-- yasak — burada da aynı ilke, kullanılmasa bile).
create or replace function public.create_default_counter_table()
returns trigger
language plpgsql
as $$
begin
  insert into public.tables (tenant_id, branch_id, label, is_counter, qr_token_hash)
  values (new.tenant_id, new.id, 'Tezgâh', true, encode(extensions.gen_random_bytes(32), 'hex'));
  return new;
end;
$$;

create trigger trg_branches_create_counter_table
  after insert on public.branches
  for each row execute function public.create_default_counter_table();

-- Backfill: mevcut şubeler (acme/beta/gamma) için de tezgâh masası oluşur.
insert into public.tables (tenant_id, branch_id, label, is_counter, qr_token_hash)
select b.tenant_id, b.id, 'Tezgâh', true, encode(extensions.gen_random_bytes(32), 'hex')
from public.branches b
where not exists (
  select 1 from public.tables t where t.branch_id = b.id and t.is_counter
);

create table public.cash_shifts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  status text not null default 'open' check (status in ('open', 'closed')),
  opening_balance_minor integer not null check (opening_balance_minor >= 0),
  opened_by uuid not null references public.profiles(id),
  opened_at timestamptz not null default now(),
  closed_by uuid references public.profiles(id),
  closed_at timestamptz,
  counted_cash_minor integer check (counted_cash_minor >= 0),
  expected_cash_minor integer,
  variance_minor integer,
  created_at timestamptz not null default now()
);
-- RULES #36: vardiya kapatılmadan yenisi açılamaz — şube başına en fazla 1 açık vardiya.
create unique index idx_cash_shifts_one_open_per_branch
  on public.cash_shifts (branch_id) where status = 'open';
create index idx_cash_shifts_tenant_id on public.cash_shifts(tenant_id);
alter table public.cash_shifts enable row level security;
create policy "cash_shifts_select" on public.cash_shifts for select
  using (tenant_id = public.current_tenant_id() and public.is_staff());
grant select on public.cash_shifts to authenticated;
grant select, insert, update, delete on public.cash_shifts to service_role;

create table public.cash_movements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  cash_shift_id uuid not null references public.cash_shifts(id) on delete restrict,
  movement_type text not null check (movement_type in ('sale', 'cash_in', 'cash_out', 'refund')),
  amount_minor integer not null check (amount_minor <> 0),
  note text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index idx_cash_movements_tenant_id on public.cash_movements(tenant_id);
create index idx_cash_movements_shift_id on public.cash_movements(cash_shift_id);
alter table public.cash_movements enable row level security;
create policy "cash_movements_select" on public.cash_movements for select
  using (tenant_id = public.current_tenant_id() and public.is_staff());
grant select on public.cash_movements to authenticated;
grant select, insert, update, delete on public.cash_movements to service_role;

-- Mutasyonlar RPC-only (RULES #5 ilkesiyle tutarlı — personel de doğrudan
-- INSERT/UPDATE yapamaz, cash.open_close izni RPC içinde doğrulanır).
create or replace function public.open_shift(p_branch_id uuid, p_opening_balance_minor integer)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid := public.current_tenant_id();
  v_shift_id uuid;
begin
  if not public.current_can('cash.open_close') then
    raise exception 'PERMISSION_DENIED:cash.open_close';
  end if;

  if exists (
    select 1 from public.cash_shifts where branch_id = p_branch_id and status = 'open'
  ) then
    raise exception 'a shift is already open for this branch';
  end if;

  insert into public.cash_shifts (tenant_id, branch_id, opening_balance_minor, opened_by)
  values (v_tenant_id, p_branch_id, p_opening_balance_minor, auth.uid())
  returning id into v_shift_id;

  return v_shift_id;
end;
$$;
revoke all on function public.open_shift(uuid, integer) from public;
grant execute on function public.open_shift(uuid, integer) to authenticated;

create or replace function public.close_shift(p_shift_id uuid, p_counted_cash_minor integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid := public.current_tenant_id();
  v_status text;
  v_opening integer;
  v_expected integer;
begin
  if not public.current_can('cash.open_close') then
    raise exception 'PERMISSION_DENIED:cash.open_close';
  end if;

  select status, opening_balance_minor into v_status, v_opening
  from public.cash_shifts
  where id = p_shift_id and tenant_id = v_tenant_id
  for update;
  if not found or v_status <> 'open' then
    raise exception 'shift is not open';
  end if;

  select v_opening + coalesce(sum(
    case when movement_type in ('sale', 'cash_in') then amount_minor
         when movement_type in ('cash_out', 'refund') then -amount_minor
         else 0 end
  ), 0)
  into v_expected
  from public.cash_movements
  where cash_shift_id = p_shift_id;

  update public.cash_shifts
  set status = 'closed',
      closed_by = auth.uid(),
      closed_at = now(),
      counted_cash_minor = p_counted_cash_minor,
      expected_cash_minor = v_expected,
      variance_minor = p_counted_cash_minor - v_expected
  where id = p_shift_id;
end;
$$;
revoke all on function public.close_shift(uuid, integer) from public;
grant execute on function public.close_shift(uuid, integer) to authenticated;

-- Manuel nakit giriş/çıkış (ör. kasaya para ekleme, para çekme). 'sale'/
-- 'refund' hareket tipleri buradan değil, ilgili ödeme/iade RPC'lerinden
-- (Adım 2/4) dahili olarak yazılır.
create or replace function public.record_cash_movement(
  p_shift_id uuid, p_movement_type text, p_amount_minor integer, p_note text default null
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
  v_movement_id uuid;
begin
  if not public.current_can('cash.open_close') then
    raise exception 'PERMISSION_DENIED:cash.open_close';
  end if;

  if p_movement_type not in ('cash_in', 'cash_out') then
    raise exception 'invalid movement type for manual entry';
  end if;

  select branch_id, status into v_branch_id, v_status
  from public.cash_shifts
  where id = p_shift_id and tenant_id = v_tenant_id;
  if not found or v_status <> 'open' then
    raise exception 'shift is not open';
  end if;

  insert into public.cash_movements (tenant_id, branch_id, cash_shift_id, movement_type, amount_minor, note, created_by)
  values (v_tenant_id, v_branch_id, p_shift_id, p_movement_type, abs(p_amount_minor), p_note, auth.uid())
  returning id into v_movement_id;

  return v_movement_id;
end;
$$;
revoke all on function public.record_cash_movement(uuid, text, integer, text) from public;
grant execute on function public.record_cash_movement(uuid, text, integer, text) to authenticated;
