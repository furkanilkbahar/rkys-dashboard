-- Faz 16 Adım 0 (S65): personel motivasyon/hedef sistemi. Siparişler personel
-- bazında atfedilmediği için (guest-driven QR sipariş modeli) hedef metriği
-- olarak garson çağrısı yanıt performansı kullanılıyor — waiter_calls
-- (0020) zaten acknowledged_by + acknowledged_at ile bunu tutuyor, PRD.md
-- §10'daki "garson performansı (yanıt süresi)" raporunun ilk somut kullanımı.
--
-- Basitlik için hedef DÖNEMSİZ tutulur (personel başına tek güncel hedef,
-- upsert edilir) — raporlama ekranındaki mevcut kayan pencereye (son 14 gün,
-- scheduling/page.tsx) karşı gösterilir; ayrı bir dönem seçici/karşılaştırma
-- UI'ı gerektirmez (Varsayım, düşük risk: gerekirse ayrı bir kural olarak
-- dönemli hedefe genişletilir).
create table public.staff_performance_goals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  target_calls_resolved integer not null check (target_calls_resolved > 0),
  updated_at timestamptz not null default now(),
  unique (tenant_id, profile_id)
);
create index idx_staff_performance_goals_tenant_branch on public.staff_performance_goals(tenant_id, branch_id);

alter table public.staff_performance_goals enable row level security;
create policy "staff_performance_goals_staff_select" on public.staff_performance_goals for select
  using (tenant_id = public.current_tenant_id() and public.is_staff());
grant select on public.staff_performance_goals to authenticated;
grant select, insert, update, delete on public.staff_performance_goals to service_role;

-- set_staff_performance_goal: staff.manage (0026 ile aynı izin bayrağı)
-- yetkisi olan (tipik olarak owner/manager) personelin güncel hedefini
-- belirler/günceller (upsert).
create or replace function public.set_staff_performance_goal(
  p_branch_id uuid,
  p_profile_id uuid,
  p_target_calls_resolved integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid := public.current_tenant_id();
  v_goal_id uuid;
begin
  if not public.current_can('staff.manage') then
    raise exception 'permission denied: staff.manage';
  end if;

  if not exists (select 1 from public.profiles where id = p_profile_id and tenant_id = v_tenant_id) then
    raise exception 'profile not found';
  end if;

  insert into public.staff_performance_goals (tenant_id, branch_id, profile_id, target_calls_resolved)
  values (v_tenant_id, p_branch_id, p_profile_id, p_target_calls_resolved)
  on conflict (tenant_id, profile_id)
  do update set target_calls_resolved = excluded.target_calls_resolved, branch_id = excluded.branch_id, updated_at = now()
  returning id into v_goal_id;

  return v_goal_id;
end;
$$;
revoke all on function public.set_staff_performance_goal(uuid, uuid, integer) from public;
grant execute on function public.set_staff_performance_goal(uuid, uuid, integer) to authenticated;
