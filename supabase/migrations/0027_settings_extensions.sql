-- Faz 2 Adım 6: tenant_settings genişletmesi + bahşiş/değerlendirme ayarları.

alter table public.tenant_settings
  add column theme_key text not null default 'warm-luxury';

-- tenants.currency Faz 0'dan beri serbest text idi (yalnız default 'TRY') —
-- ayarlar ekranı bir seçim listesi sunacağı için desteklenen para birimleri
-- burada da CHECK ile sabitlenir (diğer enum benzeri kolonlarla tutarlı).
alter table public.tenants
  add constraint tenants_currency_check check (currency in ('TRY', 'USD', 'EUR', 'GBP'));

-- tip_presets: bahşiş çipleri (yüzde bazlı). Guest tarafı tüketicisi ödeme
-- akışıyla birlikte gelecek fazda (kasa/ödeme) — şimdilik yalnızca personel
-- tarafından yapılandırılır.
create table public.tip_presets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  label text not null,
  percentage integer not null check (percentage > 0 and percentage <= 100),
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id, label)
);
create index idx_tip_presets_tenant_id on public.tip_presets(tenant_id);
alter table public.tip_presets enable row level security;
create policy "tip_presets_select" on public.tip_presets for select
  using (tenant_id = public.current_tenant_id() and public.is_staff());
create policy "tip_presets_staff_write" on public.tip_presets for all
  using (tenant_id = public.current_tenant_id() and public.is_staff())
  with check (tenant_id = public.current_tenant_id() and public.is_staff());
grant select, insert, update, delete on public.tip_presets to authenticated, service_role;

-- rating_settings: yönlendirme eşiği (RULES #30: ≤3★ Google'a asla
-- yönlendirilmez) kasıtlı olarak kolon DEĞİL — kod seviyesinde sabit, tenant
-- tarafından yapılandırılamaz.
create table public.rating_settings (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  is_enabled boolean not null default false,
  google_review_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.rating_settings enable row level security;
create policy "rating_settings_select" on public.rating_settings for select
  using (tenant_id = public.current_tenant_id() and public.is_staff());
create policy "rating_settings_staff_update" on public.rating_settings for update
  using (tenant_id = public.current_tenant_id() and public.is_staff())
  with check (tenant_id = public.current_tenant_id() and public.is_staff());
grant select, update on public.rating_settings to authenticated, service_role;
grant insert on public.rating_settings to service_role;

create or replace function public.create_default_rating_settings()
returns trigger
language plpgsql
as $$
begin
  insert into public.rating_settings (tenant_id) values (new.id);
  return new;
end;
$$;

create trigger trg_tenants_create_rating_settings
  after insert on public.tenants
  for each row execute function public.create_default_rating_settings();

insert into public.rating_settings (tenant_id)
select id from public.tenants
on conflict (tenant_id) do nothing;

-- İşletme ayarları (para birimi/saat dilimi) yalnızca owner değiştirebilir.
-- tenants tablosu ayrıca slug/name/status gibi platform-kontrollü alanlar
-- taşıdığı için (Faz 0'daki profiles_self_update açığıyla aynı sınıf risk —
-- bkz. 0026), doğrudan RLS UPDATE politikası yerine yalnız bu iki kolonu
-- değiştiren dar kapsamlı bir RPC tercih edildi.
create or replace function public.update_tenant_business_settings(p_currency text, p_timezone text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_role() <> 'owner' then
    raise exception 'yalnızca owner işletme ayarlarını değiştirebilir';
  end if;

  update public.tenants
  set currency = p_currency, timezone = p_timezone
  where id = public.current_tenant_id();
end;
$$;
revoke all on function public.update_tenant_business_settings(text, text) from public;
grant execute on function public.update_tenant_business_settings(text, text) to authenticated;

-- S16 (çok dilli menü + para birimi biçimi): misafir tarafı tenants
-- tablosunu doğrudan okuyamaz (0007_staff_rls_hardening.sql, is_staff()
-- gated), bu yüzden currency de middleware'in anon rezolüsyonuna eklenir —
-- resolve_tenant_by_domain zaten aynı amaçla var (0002), dönüş tipi
-- değiştiği için drop+create gerekiyor.
drop function public.resolve_tenant_by_domain(text);

create or replace function public.resolve_tenant_by_domain(p_domain text)
returns table(tenant_id uuid, tenant_slug text, tenant_status text, tenant_currency text)
language sql
stable
security definer
set search_path = public
as $$
  select t.id, t.slug, t.status, t.currency
  from public.tenant_domains d
  join public.tenants t on t.id = d.tenant_id
  where d.domain = p_domain
  limit 1
$$;

grant execute on function public.resolve_tenant_by_domain(text) to anon, authenticated;

-- "en az bir dil etkin kalmalı" invarianti eşzamanlı iki istekle JS
-- katmanında (count-then-delete) yarış durumuna açık olurdu — update_staff_member
-- ile aynı sınıf koruma (son owner), bu yüzden RPC'ye taşındı.
create or replace function public.disable_tenant_locale(p_locale text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid := public.current_tenant_id();
  v_count integer;
begin
  if not public.is_staff() then
    raise exception 'staff only';
  end if;

  select count(*) into v_count from public.tenant_locales where tenant_id = v_tenant_id;
  if v_count <= 1 then
    raise exception 'at least one locale must remain enabled';
  end if;

  delete from public.tenant_locales where tenant_id = v_tenant_id and locale = p_locale;
end;
$$;
revoke all on function public.disable_tenant_locale(text) from public;
grant execute on function public.disable_tenant_locale(text) to authenticated;
