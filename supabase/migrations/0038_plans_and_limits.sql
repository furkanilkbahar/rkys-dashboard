-- Faz 4 Adım 2: planlar + masa/şube limiti (S12, RULES #28).

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key in ('starter', 'pro', 'unlimited')),
  name text not null,
  table_limit integer,
  included_branch_count integer not null default 1,
  extra_branch_price_minor integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.plans enable row level security;

-- Planlar/fiyatlandırma pazarlama sitesinde de gösterileceği için (Adım 6)
-- herkese açık okunur; yazma yalnızca Süper Admin'e ait.
create policy "plans_select_all"
  on public.plans for select
  using (true);

create policy "plans_platform_admin_write"
  on public.plans for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

grant select on public.plans to anon, authenticated, service_role;
grant insert, update, delete on public.plans to authenticated, service_role;

-- D68 taslağı — kesin fiyatlar lansmanda netleşecek (Adım 6 planında da not
-- düşüldü); extra_branch_price_minor şimdilik tüm planlarda aynı yer tutucu.
insert into public.plans (key, name, table_limit, included_branch_count, extra_branch_price_minor) values
  ('starter', 'Başlangıç', 10, 1, 50000),
  ('pro', 'Pro', 25, 2, 50000),
  ('unlimited', 'Sınırsız', null, 3, 50000)
on conflict (key) do nothing;

alter table public.tenants add column plan_id uuid references public.plans(id);

-- RULES #28: masa limiti yalnızca UI'da değil DB düzeyinde de uygulanır.
-- Trigger tercih edildi (RPC değil) — createTable (tables/actions.ts) hâlâ
-- doğrudan .insert() kullanıyor; trigger bu çağrı şeklini bozmadan her
-- INSERT yolunu (mevcut/gelecek) kapsar. plan_id atanmamış tenant (trial,
-- Adım 3'te ele alınacak) için limit uygulanmaz — table_limit null demek.
create or replace function public.enforce_table_limit()
returns trigger
language plpgsql
as $$
declare
  v_limit integer;
  v_count integer;
begin
  select p.table_limit into v_limit
  from public.tenants t
  left join public.plans p on p.id = t.plan_id
  where t.id = new.tenant_id;

  if v_limit is not null then
    select count(*) into v_count from public.tables where tenant_id = new.tenant_id;
    if v_count >= v_limit then
      raise exception 'plan table limit reached';
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_tables_enforce_limit
before insert on public.tables
for each row execute function public.enforce_table_limit();

-- Şube ekleme: included_branch_count bir SERT tavan değil, ücretsiz dahil
-- sayısı — aşımı engellemez, yalnızca "ek şube ücreti" bilgisini UI'a döner
-- (gerçek faturalama Adım 3/6). Bu yüzden branches için bir INSERT trigger'ı
-- yok; owner-only RPC üzerinden oluşturulur (yapısal bir işlem, doğrudan
-- authenticated INSERT'e açık değil).
-- search_path'e "extensions" eklendi (0026'daki create_staff_device'la aynı
-- gerekçe): INSERT, create_default_counter_table trigger'ını (0029) tetikler
-- ve o trigger gen_random_bytes()'i (pgcrypto, extensions şemasında) çağırır.
create or replace function public.create_branch(p_name text)
returns table(branch_id uuid, extra_fee_applies boolean)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_tenant_id uuid := public.current_tenant_id();
  v_included integer;
  v_count integer;
  v_new_id uuid;
begin
  if public.current_role() <> 'owner' then
    raise exception 'owner only';
  end if;

  select coalesce(p.included_branch_count, 1) into v_included
  from public.tenants t
  left join public.plans p on p.id = t.plan_id
  where t.id = v_tenant_id;

  select count(*) into v_count from public.branches where tenant_id = v_tenant_id;

  insert into public.branches (tenant_id, name, is_default)
  values (v_tenant_id, p_name, false)
  returning id into v_new_id;

  return query select v_new_id, (v_count + 1) > v_included;
end;
$$;
revoke all on function public.create_branch(text) from public;
grant execute on function public.create_branch(text) to authenticated;

create or replace function public.assign_tenant_plan(p_tenant_id uuid, p_plan_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'platform admin only';
  end if;

  update public.tenants set plan_id = p_plan_id where id = p_tenant_id;
  if not found then
    raise exception 'tenant not found';
  end if;
end;
$$;
revoke all on function public.assign_tenant_plan(uuid, uuid) from public;
grant execute on function public.assign_tenant_plan(uuid, uuid) to authenticated;
