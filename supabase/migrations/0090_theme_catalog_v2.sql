-- Faz 21 Adım 0 / D88: tema kataloğu v2.
--
-- `warm-luxury` ve `sage-bistro` emekliye ayrılıyor; yerlerine üç yeni tema
-- geliyor: gece (koyu+amber), kagit (krem/espresso/altın, açık), kor
-- (siyah+kırmızı). Üçü aynı bileşen setini kullanır, yalnızca token'ları
-- değişir (bkz. src/themes/tenant/, DESIGN.md).
--
-- EŞLEME GEREKÇESİ: emekli olan iki temanın İKİSİ DE AÇIK temaydı. İkisini de
-- `kagit`'a eşliyoruz ki hiçbir işletmenin menüsü bir gecede siyaha dönmesin.
-- `warm-luxury`'nin espresso/krem/altın kimliği zaten `kagit`'ta devam ediyor.
-- Yeni tenant varsayılanı `gece` olur (en çok yönlü tema).
--
-- Sıra önemli: FK (tenant_settings_theme_key_fkey, 0052) yüzünden önce yeni
-- satırlar eklenir, sonra atamalar taşınır, sonra default değişir, en son
-- eski satırlar silinir.

-- 1) Yeni katalog satırları. `name` yalnızca yedek (fallback) — UI önce
--    i18n anahtarını (admin.settings.themes.<key>) dener; D81'in deseni.
insert into public.themes (key, name, is_public) values
  ('gece',  'Gece',  true),
  ('kagit', 'Kâğıt', true),
  ('kor',   'Kor',   true);

-- 2) Mevcut tenant atamalarını taşı.
update public.tenant_settings
   set theme_key = 'kagit'
 where theme_key in ('warm-luxury', 'sage-bistro');

-- 3) Yeni tenant varsayılanı (0027'de 'warm-luxury' olarak konmuştu).
alter table public.tenant_settings
  alter column theme_key set default 'gece';

-- 4) Eski katalog satırlarını sil. Adım 2 sonrası hiçbir tenant_settings
--    satırı bunlara referans vermiyor, FK ihlali oluşmaz.
delete from public.themes where key in ('warm-luxury', 'sage-bistro');
