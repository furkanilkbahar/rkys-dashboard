-- D101 DÜZELTMESİ: 0093'ün resolve_tenant_by_domain'e eklediği
-- `subscription_active` geri alınıyor (0085'teki hâline dönüş).
--
-- NEDEN EKLENMİŞTİ: "trial dolan tenant pasife alınsın" isteği için proxy'ye
-- bir abonelik kapısı yazılacaktı ve proxy'nin bu bilgiye ihtiyacı vardı.
--
-- NEDEN GERİ ALINIYOR: o kapı ZATEN VARDI, yalnızca proxy'de değil yüzey
-- bazında — admin dashboard layout'u, waiter, kitchen, courier, analytics
-- sayfaları ve cashierGuard, hepsi isSubscriptionActive() kontrolüyle
-- /admin/billing'e yönlendiriyor (S13). Eklenen proxy kapısı bu davranışı
-- ikizlemekle kalmıyor, S13'ün BİLİNÇLİ kararını da bozuyordu: trial bitince
-- misafir QR menüsü AÇIK KALIR ("tam kilit değil"), çünkü masada oturan
-- müşterinin menüsünü kapatmak işletmeyi değil misafiri cezalandırır.
--
-- Kolon geri alınıyor çünkü tek tüketicisi o proxy kapısıydı; kalırsa her
-- istekte hesaplanan, kimsenin okumadığı bir alan olur.
--
-- 0093'ün diğer iki fonksiyonu (mark_subscription_paid,
-- approve_tenant_on_registration) YERİNDE KALIYOR — ikisi de gerçek birer
-- boşluğu dolduruyor ve kullanılıyor.
drop function public.resolve_tenant_by_domain(text);

create or replace function public.resolve_tenant_by_domain(p_domain text)
returns table(tenant_id uuid, tenant_slug text, tenant_name text, tenant_status text, tenant_currency text, tenant_theme_key text)
language sql
stable
security definer
set search_path = public
as $$
  select t.id, t.slug, t.name, t.status, t.currency, s.theme_key
  from public.tenant_domains d
  join public.tenants t on t.id = d.tenant_id
  join public.tenant_settings s on s.tenant_id = t.id
  where d.domain = p_domain
  limit 1
$$;

grant execute on function public.resolve_tenant_by_domain(text) to anon, authenticated;
