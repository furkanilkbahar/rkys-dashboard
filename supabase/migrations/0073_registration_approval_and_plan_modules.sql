-- Faz 4 revizyonu Adım 0: kapalı-kapı kayıt onayı + plan-modül şablonu
-- şeması (D80/D81 hazırlığı). Bu adımda hiçbir mevcut akış davranışı
-- değişmiyor — yalnızca sonraki adımların üzerine kurulacağı zemin.

-- tenants.status: proxy.ts (resolve_tenant_by_domain üzerinden) zaten
-- 'active' DIŞINDAKİ her status'u tüm erişimi (admin login dahil) kapatıyor
-- — yeni iki değeri eklemek tek başına "onaylanana kadar erişim yok"
-- ihtiyacını karşılıyor, proxy'ye dokunmaya gerek yok.
alter table public.tenants drop constraint if exists tenants_status_check;
alter table public.tenants add constraint tenants_status_check
  check (status in ('active', 'suspended', 'pending_approval', 'rejected'));

-- tenant_modules: bir modülün plandan mı, platform admin'in elle vermesinden
-- mi, yoksa ayrıca ücretli bir eklentiden mi geldiğini ayırt eden kaynak
-- etiketi (Adım 4/5); pending_removal_since ise plan düşürmede plandan
-- gelen bir modülün hemen silinmeyip platform admin incelemesine düşmesi
-- için (Adım 5) — NULL demek "kaldırma beklemiyor".
alter table public.tenant_modules
  add column source text not null default 'plan' check (source in ('plan', 'paid_addon', 'granted')),
  add column pending_removal_since timestamptz;

-- plans.key: serbestçe yeni plan açılabilmesi için sabit 3 değer listesi
-- kaldırılıyor, unique kısıtı korunuyor (mevcut starter/pro/unlimited
-- satırları etkilenmez).
alter table public.plans drop constraint if exists plans_key_check;

-- RULES: para değerleri integer kuruş. Mevcut 3 plan kullanıcının
-- onayladığı temsili örnek fiyatlarla dolduruluyor (₺499/₺999/₺1999) —
-- açıkça placeholder, platform admin /platform/plans üzerinden istediği an
-- değiştirir (Adım 1).
alter table public.plans add column price_minor integer not null default 0;

update public.plans set price_minor = 49900 where key = 'starter';
update public.plans set price_minor = 99900 where key = 'pro';
update public.plans set price_minor = 199900 where key = 'unlimited';

-- plan_modules: bir planın varsayılan olarak içerdiği modüller. plans ile
-- aynı RLS deseni (0038) — pazarlama/kayıt akışında herkese açık okunur,
-- yazma yalnızca platform admin.
create table public.plan_modules (
  plan_id uuid not null references public.plans(id) on delete cascade,
  module_key text not null check (module_key in (
    'pos_cash', 'inventory', 'recipes', 'crm_loyalty', 'campaigns', 'gift_cards',
    'pickup', 'delivery', 'courier', 'marketplace', 'reservations', 'kiosk',
    'staff_scheduling', 'accounting_export', 'api_access'
  )),
  primary key (plan_id, module_key)
);

alter table public.plan_modules enable row level security;

create policy "plan_modules_select_all"
  on public.plan_modules for select
  using (true);

create policy "plan_modules_platform_admin_write"
  on public.plan_modules for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

grant select on public.plan_modules to anon, authenticated, service_role;
grant insert, update, delete on public.plan_modules to authenticated, service_role;

-- Taslak dağıtım (Varsayım — kullanıcı Adım 1'in düzenleme ekranından
-- istediği an değiştirebilir, bkz. Context): Başlangıç temel operasyon,
-- Pro büyüme özellikleri, Sınırsız 15 modülün tamamı.
insert into public.plan_modules (plan_id, module_key)
select p.id, m.module_key
from public.plans p
cross join (
  values ('pos_cash'), ('inventory')
) as m(module_key)
where p.key = 'starter'
on conflict do nothing;

insert into public.plan_modules (plan_id, module_key)
select p.id, m.module_key
from public.plans p
cross join (
  values
    ('pos_cash'), ('inventory'), ('recipes'), ('crm_loyalty'), ('campaigns'),
    ('pickup'), ('delivery'), ('reservations'), ('staff_scheduling')
) as m(module_key)
where p.key = 'pro'
on conflict do nothing;

insert into public.plan_modules (plan_id, module_key)
select p.id, m.module_key
from public.plans p
cross join (
  values
    ('pos_cash'), ('inventory'), ('recipes'), ('crm_loyalty'), ('campaigns'), ('gift_cards'),
    ('pickup'), ('delivery'), ('courier'), ('marketplace'), ('reservations'), ('kiosk'),
    ('staff_scheduling'), ('accounting_export'), ('api_access')
) as m(module_key)
where p.key = 'unlimited'
on conflict do nothing;

-- module_requests: tenant'ın plan dışı bir modül için "Talep Et" dediği
-- kayıtlar (Adım 6). tenant_modules (0005) ile aynı tenant-izolasyon
-- deseni + is_staff() (misafir asla göremez/oluşturamaz).
create table public.module_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  module_key text not null check (module_key in (
    'pos_cash', 'inventory', 'recipes', 'crm_loyalty', 'campaigns', 'gift_cards',
    'pickup', 'delivery', 'courier', 'marketplace', 'reservations', 'kiosk',
    'staff_scheduling', 'accounting_export', 'api_access'
  )),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index idx_module_requests_tenant_id on public.module_requests(tenant_id);

alter table public.module_requests enable row level security;

create policy "module_requests_tenant_isolation"
  on public.module_requests for select
  using (tenant_id = public.current_tenant_id() and public.is_staff());

create policy "module_requests_tenant_insert"
  on public.module_requests for insert
  with check (tenant_id = public.current_tenant_id() and public.is_staff());

create policy "module_requests_platform_admin_all"
  on public.module_requests for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

grant select, insert on public.module_requests to authenticated;
grant select, insert, update, delete on public.module_requests to service_role;

-- platform_settings: enforce_2fa (0037) ile aynı singleton tablo, onay
-- akışının ödeme sonrası otomatik mi yoksa platform admin'in elle onayı mı
-- gerektiğini belirleyen genel anahtar (Adım 3).
alter table public.platform_settings
  add column auto_approve_registrations boolean not null default false;

-- seed_tenant_modules_from_plan: tenant'ın güncel planına ait plan_modules
-- satırlarını tenant_modules'a source='plan' ile açar (zaten açık olan bir
-- modüle dokunmaz — on conflict do nothing). Onay (Adım 2) ve plan
-- değişikliği (apply_plan_change, aşağıda) yollarının ikisi de bunu
-- çağırır, tek bir yerde tanımlı (DRY).
create or replace function public.seed_tenant_modules_from_plan(p_tenant_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.tenant_modules (tenant_id, module_key, is_enabled, source)
  select p_tenant_id, pm.module_key, true, 'plan'
  from public.tenants t
  join public.plan_modules pm on pm.plan_id = t.plan_id
  where t.id = p_tenant_id
  on conflict (tenant_id, module_key) do nothing;
end;
$$;
revoke all on function public.seed_tenant_modules_from_plan(uuid) from public;
grant execute on function public.seed_tenant_modules_from_plan(uuid) to service_role;

-- apply_plan_change: tenants.plan_id'yi günceller. Yeni planda ARTIK
-- bulunmayan ve source='plan' olan açık modülleri hemen silmez, yalnızca
-- pending_removal_since=now() ile işaretler (Adım 5'te platform admin
-- Koru/Kaldır kararına bağlanır) — daha önce işaretlenmiş ama yeni planda
-- TEKRAR yer alan modüllerin işaretini temizler (yükseltme/geri-yükseltme).
-- source='paid_addon' olan satırlara hiç dokunmaz (RULES/Context: ayrıca
-- ücret ödenmiş modül kalıcı korunur). Ardından yeni planın getirdiği
-- modülleri seed_tenant_modules_from_plan ile açar. Yetki kontrolü burada
-- YAPILMAZ — çağıran taraf (assign_tenant_plan, billing akışı) kendi
-- yetkisini kendi denetler; bu fonksiyon yalnızca paylaşılan iş mantığıdır.
create or replace function public.apply_plan_change(p_tenant_id uuid, p_new_plan_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.tenants set plan_id = p_new_plan_id where id = p_tenant_id;

  update public.tenant_modules tm
  set pending_removal_since = now()
  where tm.tenant_id = p_tenant_id
    and tm.source = 'plan'
    and tm.is_enabled
    and tm.pending_removal_since is null
    and not exists (
      select 1 from public.plan_modules pm
      where pm.plan_id = p_new_plan_id and pm.module_key = tm.module_key
    );

  update public.tenant_modules tm
  set pending_removal_since = null
  where tm.tenant_id = p_tenant_id
    and tm.source = 'plan'
    and tm.pending_removal_since is not null
    and exists (
      select 1 from public.plan_modules pm
      where pm.plan_id = p_new_plan_id and pm.module_key = tm.module_key
    );

  perform public.seed_tenant_modules_from_plan(p_tenant_id);
end;
$$;
revoke all on function public.apply_plan_change(uuid, uuid) from public;
grant execute on function public.apply_plan_change(uuid, uuid) to service_role;
