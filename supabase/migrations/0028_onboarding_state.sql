-- Faz 2 Adım 7: onboarding durumu + demo veri temizleme.

alter table public.tenants add column onboarding_completed_at timestamptz;
alter table public.tenants add column logo_url text;

-- profiles Faz 0'dan beri yalnızca select/update grant'ine sahipti (bkz.
-- 0003 — "Faz 0'da self-servis kayıt akışı yok"). Bu fazın onboarding
-- tasarımı ("tenant+ilk owner hesabı seed/service-role ile var sayılır",
-- PLAN.md) service_role'ün yeni bir tenant için ilk owner profilini
-- oluşturabilmesini gerektiriyor — service_role zaten RLS'i bypass eden tam
-- güvenilir bir rol (yalnız server-side, RULES #3), bu grant onu tabloya da
-- tutarlı kılar. authenticated/anon dokunulmaz.
grant insert on public.profiles to service_role;

create or replace function public.update_tenant_logo(p_logo_url text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_role() <> 'owner' then
    raise exception 'yalnızca owner logo değiştirebilir';
  end if;

  update public.tenants set logo_url = p_logo_url where id = public.current_tenant_id();
end;
$$;
revoke all on function public.update_tenant_logo(text) from public;
grant execute on function public.update_tenant_logo(text) to authenticated;

create or replace function public.complete_onboarding()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    raise exception 'staff only';
  end if;

  update public.tenants
  set onboarding_completed_at = coalesce(onboarding_completed_at, now())
  where id = public.current_tenant_id();
end;
$$;
revoke all on function public.complete_onboarding() from public;
grant execute on function public.complete_onboarding() to authenticated;

-- "Sıfırdan kur" yolu: demo katalog/masa/çağrı-tipi/çeviri verisi silinir.
-- RULES #18 (sipariş/ödeme geçmişi asla silinmez) burada da mutlak: products/
-- tables üzerindeki mevcut "on delete restrict" kısıtları (order_items,
-- table_sessions) gerçek sipariş geçmişi olan bir satırın silinmesini zaten
-- veritabanı seviyesinde engeller — RPC ayrıca onboarding tamamlanmışsa hiç
-- çalışmaz (guard).
create or replace function public.clear_demo_data()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid := public.current_tenant_id();
begin
  if not public.is_staff() then
    raise exception 'staff only';
  end if;

  if exists (
    select 1 from public.tenants
    where id = v_tenant_id and onboarding_completed_at is not null
  ) then
    raise exception 'onboarding already completed, demo data cannot be cleared';
  end if;

  delete from public.content_translations
  where tenant_id = v_tenant_id
    and entity_type in ('menu_category', 'product', 'product_variant', 'product_extra', 'call_type');

  delete from public.products where tenant_id = v_tenant_id;
  delete from public.menu_categories where tenant_id = v_tenant_id;
  delete from public.generic_qr_codes where tenant_id = v_tenant_id;
  delete from public.tables where tenant_id = v_tenant_id;
  delete from public.table_zones where tenant_id = v_tenant_id;
  delete from public.call_types where tenant_id = v_tenant_id;
  delete from public.tip_presets where tenant_id = v_tenant_id;
  delete from public.tenant_locales where tenant_id = v_tenant_id;
end;
$$;
revoke all on function public.clear_demo_data() from public;
grant execute on function public.clear_demo_data() to authenticated;
