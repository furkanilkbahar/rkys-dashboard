-- Faz 24 (D101): kayıtta ödeme kaldırılıyor, abonelik kapısı devreye giriyor.
--
-- D80 kayıt akışına bir ödeme adımı koymuştu; D18 ise "14 gün tam özellikli
-- trial, kart istenmez" diyor. İkisi aynı anda doğru olamazdı ve pratikte
-- şuna dönüşmüştü: ana sayfa "Ücretsiz Deneyin / 14 gün kartsız deneme"
-- diyor, kayıt formu ₺0'lık Demo planını varsayılan seçiyor, kullanıcı ₺0
-- ödemek için checkout sayfasına gönderiliyordu. Üstelik trg_tenants_create_
-- subscription (0039) o tenant'a zaten 14 günlük trialing satırı açtığı için
-- o ödeme hiçbir şey satın almıyordu.
--
-- D101: D18 kazanır. Kayıtta ödeme yok. Bunun karşılığında trial'ın BİTİŞİ
-- artık bir sonuç doğurmalı — bugün doğurmuyor: is_subscription_active()
-- (0039) tanımlı ama hiçbir kapıda kullanılmıyor, yani 14 gün dolan tenant
-- sonsuza kadar çalışmaya devam ediyor.

-- ─────────────────────────────────────────────────────────────────────────
-- 1) Proxy'nin abonelik kapısı için ihtiyaç duyduğu alan.
--
-- Pasiflik SAKLANMIYOR, TÜRETİLİYOR: "trial doldu" durumunu bir kolona yazıp
-- zamanlanmış bir görevle çevirmek yerine her istekte is_subscription_active()
-- hesaplanıyor. Zamanlanmış görev olmadığı için kaçırılan/başarısız bir job
-- yüzünden ödemeyen tenant açık kalamaz; ters yönde de ödeme yapıldığı an
-- servis geri gelir, bir job'ın çalışmasını beklemez.
drop function public.resolve_tenant_by_domain(text);

create or replace function public.resolve_tenant_by_domain(p_domain text)
returns table(
  tenant_id uuid,
  tenant_slug text,
  tenant_name text,
  tenant_status text,
  tenant_currency text,
  tenant_theme_key text,
  subscription_active boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select t.id, t.slug, t.name, t.status, t.currency, s.theme_key,
         public.is_subscription_active(t.id)
  from public.tenant_domains d
  join public.tenants t on t.id = d.tenant_id
  join public.tenant_settings s on s.tenant_id = t.id
  where d.domain = p_domain
  limit 1
$$;

grant execute on function public.resolve_tenant_by_domain(text) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 2) Elle ödeme işareti (havale/EFT, saha tahsilatı).
--
-- payments (0031) zaten provider='manual' değerini tanıyor; subscriptions
-- 0039'da yalnızca ('mock','iyzico') ile kısıtlıydı çünkü o zaman tek yol
-- sağlayıcı checkout'uydu.
alter table public.subscriptions drop constraint subscriptions_provider_check;
alter table public.subscriptions
  add constraint subscriptions_provider_check check (provider in ('manual', 'mock', 'iyzico'));

-- Süper Admin "parası alındı" der ve tenant pasiflikten çıkar. activate_
-- subscription (0076) ile aynı işi yapar ama sağlayıcı webhook'u yerine
-- platform admin kimliğine dayanır ve pending_approval'ı auto_approve
-- ayarına BAKMADAN açar: burada onayı zaten bir insan veriyor.
create or replace function public.mark_subscription_paid(p_tenant_id uuid, p_period_days integer default 30)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'platform admin only';
  end if;

  update public.subscriptions
  set status = 'active',
      provider = 'manual',
      current_period_end = now() + make_interval(days => greatest(p_period_days, 1)),
      updated_at = now()
  where tenant_id = p_tenant_id;

  if not found then
    raise exception 'subscription not found';
  end if;

  update public.tenants
  set status = 'active'
  where id = p_tenant_id and status = 'pending_approval';

  -- Tenant zaten aktifken (normal yenileme) FOUND false kalır ve modüller
  -- boşuna yeniden seed edilmez.
  if found then
    perform public.seed_tenant_modules_from_plan(p_tenant_id);
  end if;
end;
$$;
revoke all on function public.mark_subscription_paid(uuid, integer) from public;
grant execute on function public.mark_subscription_paid(uuid, integer) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 3) Otomatik onay ödeme webhook'undan kayıt anına taşınıyor.
--
-- 0076 auto_approve_registrations'ı activate_subscription'ın içine koymuştu;
-- ödeme adımı kalkınca o dal kayıt akışında hiç çalışmaz ve ayar açık olsa
-- bile her tenant onay kuyruğunda beklerdi. activate_subscription'daki dal
-- SİLİNMİYOR: pending_approval bir tenant billing'den ödeme yaparsa onu
-- açmak hâlâ doğru davranış.
--
-- service_role'e veriliyor çünkü çağıran registerTenant server action'ı ve o
-- noktada henüz oturum yok (D80'in set_subscription_checkout_ref için
-- düştüğü notun aynısı).
create or replace function public.approve_tenant_on_registration(p_tenant_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.tenants
  set status = 'active'
  where id = p_tenant_id
    and status = 'pending_approval'
    and (select auto_approve_registrations from public.platform_settings where id = true);

  if found then
    perform public.seed_tenant_modules_from_plan(p_tenant_id);
    return true;
  end if;

  return false;
end;
$$;
revoke all on function public.approve_tenant_on_registration(uuid) from public;
grant execute on function public.approve_tenant_on_registration(uuid) to service_role;
