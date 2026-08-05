-- Demo seed: 2 tenant, her biri 1 şube, tam modül seti, temel izin bayrakları.
-- Idempotent: `supabase db reset` her koşumda tabloları sıfırdan kurduğu için
-- on conflict koruması sadece manuel tekrar-koşum için güvenlik.

-- Vitrin dışı plan (D96). 0038 üç halka açık planı kuruyor; bu satır dördüncü
-- bir örnek olarak `is_public = false` yolunu LOKALDE de var ediyor, çünkü
-- aksi halde "Demo planı kayıt formunda görünür ama ana sayfada görünmez"
-- davranışının testi yazılamaz — üretimde bu planı Süper Admin açmıştı,
-- lokalde hiç yoktu ve regresyon sessizce geri gelebilirdi.
insert into public.plans (key, name, price_minor, table_limit, included_branch_count, extra_branch_price_minor, is_public)
values ('demo', 'Demo', 0, 5, 1, 0, false)
on conflict (key) do update set is_public = excluded.is_public;

-- gamma: Faz 2 Adım 7 (onboarding) için onboarding_completed_at = null taze
-- tenant — "Demo veriyle keşfet" yolunun göstereceği minimal demo katalog +
-- "Sıfırdan kur" yolunun clear_demo_data() ile temizleyeceği veri burada.
insert into public.tenants (id, slug, name, status, timezone, currency, onboarding_completed_at)
values
  ('00000000-0000-4000-8000-000000000001', 'acme', 'Acme Kafe', 'active', 'Europe/Istanbul', 'TRY', now()),
  ('00000000-0000-4000-8000-000000000002', 'beta', 'Beta Restoran', 'active', 'Europe/Istanbul', 'TRY', now()),
  ('00000000-0000-4000-8000-000000000003', 'gamma', 'Gamma Bistro', 'active', 'Europe/Istanbul', 'TRY', null)
on conflict (id) do nothing;

insert into public.tenant_domains (tenant_id, domain, is_primary)
values
  ('00000000-0000-4000-8000-000000000001', 'acme.localhost:3000', true),
  ('00000000-0000-4000-8000-000000000002', 'beta.localhost:3000', true),
  ('00000000-0000-4000-8000-000000000003', 'gamma.localhost:3000', true)
on conflict (domain) do nothing;

insert into public.branches (id, tenant_id, name, is_default)
values
  ('00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000001', 'Merkez Şube', true),
  ('00000000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000002', 'Merkez Şube', true),
  ('00000000-0000-4000-8000-000000000013', '00000000-0000-4000-8000-000000000003', 'Merkez Şube', true)
on conflict (id) do nothing;

-- acme: pos_cash açık (guard'ın "açık" ucunu gösterir). beta: hepsi kapalı
-- (guard'ın "kapalı modül hiçbir yüzeyde görünmez" ucunu gösterir, RULES #34).
insert into public.tenant_modules (tenant_id, module_key, is_enabled)
select t.id, m.module_key, (t.slug = 'acme' and m.module_key = 'pos_cash')
from public.tenants t
cross join (
  values
    ('pos_cash'), ('inventory'), ('recipes'), ('crm_loyalty'), ('campaigns'), ('gift_cards'),
    ('pickup'), ('delivery'), ('courier'), ('marketplace'), ('reservations'), ('kiosk'),
    ('staff_scheduling'), ('accounting_export'), ('api_access'), ('fiscal_integration')
) as m(module_key)
on conflict (tenant_id, module_key) do nothing;

insert into public.role_permissions (tenant_id, role, permission_key, allowed)
select t.id, r.role, p.permission_key, true
from public.tenants t
cross join (values ('owner'), ('manager')) as r(role)
cross join (
  values
    ('comp_discount'), ('refund'), ('reports.revenue'), ('reports.profit'),
    ('menu.edit'), ('cash.open_close'), ('session.move'), ('reservations.manage'),
    ('staff.manage')
) as p(permission_key)
on conflict (tenant_id, role, permission_key) do nothing;

-- Demo menü kataloğu (Faz 1): acme'de varyant+ekstra+tükenmiş ürün örnekleri,
-- beta'da minimal bir tenant-izolasyon karşılaştırma seti.
insert into public.tenant_locales (tenant_id, locale, is_default)
values
  ('00000000-0000-4000-8000-000000000001', 'tr', true),
  ('00000000-0000-4000-8000-000000000001', 'en', false),
  ('00000000-0000-4000-8000-000000000002', 'tr', true),
  ('00000000-0000-4000-8000-000000000002', 'en', false),
  ('00000000-0000-4000-8000-000000000003', 'tr', true)
on conflict (tenant_id, locale) do nothing;

insert into public.menu_categories (id, tenant_id, layout, display_order)
values
  ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000001', 'grid', 0),
  ('00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000001', 'list', 1),
  ('00000000-0000-4000-8000-000000000103', '00000000-0000-4000-8000-000000000002', 'grid', 0),
  ('00000000-0000-4000-8000-000000000104', '00000000-0000-4000-8000-000000000003', 'grid', 0)
on conflict (id) do nothing;

insert into public.products (id, tenant_id, category_id, track_mode, base_price_minor, stock_quantity, is_sold_out, display_order)
values
  ('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', 'simple', 8000, null, false, 0),
  ('00000000-0000-4000-8000-000000000202', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', 'simple', 9000, null, false, 1),
  ('00000000-0000-4000-8000-000000000203', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000102', 'simple', 12000, 0, true, 0),
  ('00000000-0000-4000-8000-000000000204', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000103', 'simple', 15000, null, false, 0),
  ('00000000-0000-4000-8000-000000000205', '00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000104', 'simple', 7000, null, false, 0)
on conflict (id) do nothing;

insert into public.product_variants (id, tenant_id, product_id, price_minor, display_order)
values
  ('00000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000202', 9000, 0),
  ('00000000-0000-4000-8000-000000000302', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000202', 11000, 1)
on conflict (id) do nothing;

insert into public.product_extras (id, tenant_id, product_id, price_minor, display_order)
values
  ('00000000-0000-4000-8000-000000000401', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000203', 1500, 0),
  ('00000000-0000-4000-8000-000000000402', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000203', 1500, 1)
on conflict (id) do nothing;

insert into public.content_translations (tenant_id, entity_type, entity_id, locale, field, value)
values
  ('00000000-0000-4000-8000-000000000001', 'menu_category', '00000000-0000-4000-8000-000000000101', 'tr', 'name', 'İçecekler'),
  ('00000000-0000-4000-8000-000000000001', 'menu_category', '00000000-0000-4000-8000-000000000101', 'en', 'name', 'Beverages'),
  ('00000000-0000-4000-8000-000000000001', 'menu_category', '00000000-0000-4000-8000-000000000102', 'tr', 'name', 'Tatlılar'),
  ('00000000-0000-4000-8000-000000000001', 'menu_category', '00000000-0000-4000-8000-000000000102', 'en', 'name', 'Desserts'),
  ('00000000-0000-4000-8000-000000000002', 'menu_category', '00000000-0000-4000-8000-000000000103', 'tr', 'name', 'Ana Yemekler'),
  ('00000000-0000-4000-8000-000000000002', 'menu_category', '00000000-0000-4000-8000-000000000103', 'en', 'name', 'Main Courses'),
  ('00000000-0000-4000-8000-000000000001', 'product', '00000000-0000-4000-8000-000000000201', 'tr', 'name', 'Filtre Kahve'),
  ('00000000-0000-4000-8000-000000000001', 'product', '00000000-0000-4000-8000-000000000201', 'en', 'name', 'Filter Coffee'),
  ('00000000-0000-4000-8000-000000000001', 'product', '00000000-0000-4000-8000-000000000202', 'tr', 'name', 'Latte'),
  ('00000000-0000-4000-8000-000000000001', 'product', '00000000-0000-4000-8000-000000000202', 'en', 'name', 'Latte'),
  ('00000000-0000-4000-8000-000000000001', 'product', '00000000-0000-4000-8000-000000000203', 'tr', 'name', 'Cheesecake'),
  ('00000000-0000-4000-8000-000000000001', 'product', '00000000-0000-4000-8000-000000000203', 'en', 'name', 'Cheesecake'),
  ('00000000-0000-4000-8000-000000000002', 'product', '00000000-0000-4000-8000-000000000204', 'tr', 'name', 'Beta Burger'),
  ('00000000-0000-4000-8000-000000000002', 'product', '00000000-0000-4000-8000-000000000204', 'en', 'name', 'Beta Burger'),
  ('00000000-0000-4000-8000-000000000001', 'product_variant', '00000000-0000-4000-8000-000000000301', 'tr', 'name', 'Küçük'),
  ('00000000-0000-4000-8000-000000000001', 'product_variant', '00000000-0000-4000-8000-000000000301', 'en', 'name', 'Small'),
  ('00000000-0000-4000-8000-000000000001', 'product_variant', '00000000-0000-4000-8000-000000000302', 'tr', 'name', 'Büyük'),
  ('00000000-0000-4000-8000-000000000001', 'product_variant', '00000000-0000-4000-8000-000000000302', 'en', 'name', 'Large'),
  ('00000000-0000-4000-8000-000000000001', 'product_extra', '00000000-0000-4000-8000-000000000401', 'tr', 'name', 'Çilek Sosu'),
  ('00000000-0000-4000-8000-000000000001', 'product_extra', '00000000-0000-4000-8000-000000000401', 'en', 'name', 'Strawberry Sauce'),
  ('00000000-0000-4000-8000-000000000001', 'product_extra', '00000000-0000-4000-8000-000000000402', 'tr', 'name', 'Çikolata Sosu'),
  ('00000000-0000-4000-8000-000000000001', 'product_extra', '00000000-0000-4000-8000-000000000402', 'en', 'name', 'Chocolate Sauce'),
  ('00000000-0000-4000-8000-000000000003', 'menu_category', '00000000-0000-4000-8000-000000000104', 'tr', 'name', 'Kahveler'),
  -- gamma'nın ürünü acme'nin 'Filtre Kahve'siyle aynı adı taşıyordu; demo
  -- verisinde tenant'lar arası ad tekrarı kalmasın diye beta'nın 'Beta
  -- Burger' deseni izlendi. Hiçbir test gamma'nın ürününü ADA göre bulmuyor.
  ('00000000-0000-4000-8000-000000000003', 'product', '00000000-0000-4000-8000-000000000205', 'tr', 'name', 'Gamma Kahve')
on conflict (entity_type, entity_id, locale, field) do nothing;

-- D35 standart çağrı tipi seti (her iki tenant için) + tipsiz tek dokunuş
-- (call_type_id null, seed'e gerek yok, RPC parametresiz çağrılır).
insert into public.call_types (id, tenant_id, key, is_system, display_order)
values
  ('00000000-0000-4000-8000-000000000701', '00000000-0000-4000-8000-000000000001', 'water', true, 0),
  ('00000000-0000-4000-8000-000000000702', '00000000-0000-4000-8000-000000000001', 'check', true, 1),
  ('00000000-0000-4000-8000-000000000703', '00000000-0000-4000-8000-000000000001', 'assistance', true, 2),
  ('00000000-0000-4000-8000-000000000704', '00000000-0000-4000-8000-000000000002', 'water', true, 0),
  ('00000000-0000-4000-8000-000000000705', '00000000-0000-4000-8000-000000000002', 'check', true, 1),
  ('00000000-0000-4000-8000-000000000706', '00000000-0000-4000-8000-000000000002', 'assistance', true, 2),
  ('00000000-0000-4000-8000-000000000707', '00000000-0000-4000-8000-000000000003', 'water', true, 0),
  -- gamma başlangıçta yalnızca 'water' ile seed edilmişti; 'check' (hesap
  -- iste) ve 'assistance' eksikti — bug-hunt 2026-08-01 ile tamamlandı.
  ('00000000-0000-4000-8000-000000000708', '00000000-0000-4000-8000-000000000003', 'check', true, 1),
  ('00000000-0000-4000-8000-000000000709', '00000000-0000-4000-8000-000000000003', 'assistance', true, 2)
on conflict (id) do nothing;

insert into public.content_translations (tenant_id, entity_type, entity_id, locale, field, value)
values
  ('00000000-0000-4000-8000-000000000001', 'call_type', '00000000-0000-4000-8000-000000000701', 'tr', 'name', 'Su İstiyorum'),
  ('00000000-0000-4000-8000-000000000001', 'call_type', '00000000-0000-4000-8000-000000000701', 'en', 'name', 'Water, please'),
  ('00000000-0000-4000-8000-000000000001', 'call_type', '00000000-0000-4000-8000-000000000702', 'tr', 'name', 'Hesap İstiyorum'),
  ('00000000-0000-4000-8000-000000000001', 'call_type', '00000000-0000-4000-8000-000000000702', 'en', 'name', 'Check, please'),
  ('00000000-0000-4000-8000-000000000001', 'call_type', '00000000-0000-4000-8000-000000000703', 'tr', 'name', 'Yardım İstiyorum'),
  ('00000000-0000-4000-8000-000000000001', 'call_type', '00000000-0000-4000-8000-000000000703', 'en', 'name', 'I need help'),
  ('00000000-0000-4000-8000-000000000002', 'call_type', '00000000-0000-4000-8000-000000000704', 'tr', 'name', 'Su İstiyorum'),
  ('00000000-0000-4000-8000-000000000002', 'call_type', '00000000-0000-4000-8000-000000000704', 'en', 'name', 'Water, please'),
  ('00000000-0000-4000-8000-000000000002', 'call_type', '00000000-0000-4000-8000-000000000705', 'tr', 'name', 'Hesap İstiyorum'),
  ('00000000-0000-4000-8000-000000000002', 'call_type', '00000000-0000-4000-8000-000000000705', 'en', 'name', 'Check, please'),
  ('00000000-0000-4000-8000-000000000002', 'call_type', '00000000-0000-4000-8000-000000000706', 'tr', 'name', 'Yardım İstiyorum'),
  ('00000000-0000-4000-8000-000000000002', 'call_type', '00000000-0000-4000-8000-000000000706', 'en', 'name', 'I need help'),
  ('00000000-0000-4000-8000-000000000003', 'call_type', '00000000-0000-4000-8000-000000000707', 'tr', 'name', 'Su İstiyorum')
on conflict (entity_type, entity_id, locale, field) do nothing;

-- Faz 3 Adım 4: comp/refund/cancel sebep kodları (acme + beta), call_types
-- ile aynı desen.
insert into public.reason_codes (id, tenant_id, category, key, display_order)
values
  ('00000000-0000-4000-8000-000000000801', '00000000-0000-4000-8000-000000000001', 'comp', 'goodwill', 0),
  ('00000000-0000-4000-8000-000000000802', '00000000-0000-4000-8000-000000000001', 'comp', 'staff_meal', 1),
  ('00000000-0000-4000-8000-000000000803', '00000000-0000-4000-8000-000000000001', 'refund', 'customer_complaint', 0),
  ('00000000-0000-4000-8000-000000000804', '00000000-0000-4000-8000-000000000001', 'refund', 'wrong_order', 1),
  ('00000000-0000-4000-8000-000000000805', '00000000-0000-4000-8000-000000000001', 'cancel', 'out_of_stock', 0),
  ('00000000-0000-4000-8000-000000000806', '00000000-0000-4000-8000-000000000002', 'comp', 'goodwill', 0),
  ('00000000-0000-4000-8000-000000000807', '00000000-0000-4000-8000-000000000002', 'refund', 'customer_complaint', 0)
on conflict (id) do nothing;

insert into public.content_translations (tenant_id, entity_type, entity_id, locale, field, value)
values
  ('00000000-0000-4000-8000-000000000001', 'reason_code', '00000000-0000-4000-8000-000000000801', 'tr', 'name', 'İyi Niyet İkramı'),
  ('00000000-0000-4000-8000-000000000001', 'reason_code', '00000000-0000-4000-8000-000000000801', 'en', 'name', 'Goodwill Comp'),
  ('00000000-0000-4000-8000-000000000001', 'reason_code', '00000000-0000-4000-8000-000000000802', 'tr', 'name', 'Personel Yemeği'),
  ('00000000-0000-4000-8000-000000000001', 'reason_code', '00000000-0000-4000-8000-000000000802', 'en', 'name', 'Staff Meal'),
  ('00000000-0000-4000-8000-000000000001', 'reason_code', '00000000-0000-4000-8000-000000000803', 'tr', 'name', 'Müşteri Şikayeti'),
  ('00000000-0000-4000-8000-000000000001', 'reason_code', '00000000-0000-4000-8000-000000000803', 'en', 'name', 'Customer Complaint'),
  ('00000000-0000-4000-8000-000000000001', 'reason_code', '00000000-0000-4000-8000-000000000804', 'tr', 'name', 'Yanlış Sipariş'),
  ('00000000-0000-4000-8000-000000000001', 'reason_code', '00000000-0000-4000-8000-000000000804', 'en', 'name', 'Wrong Order'),
  ('00000000-0000-4000-8000-000000000001', 'reason_code', '00000000-0000-4000-8000-000000000805', 'tr', 'name', 'Stok Tükendi'),
  ('00000000-0000-4000-8000-000000000001', 'reason_code', '00000000-0000-4000-8000-000000000805', 'en', 'name', 'Out of Stock'),
  ('00000000-0000-4000-8000-000000000002', 'reason_code', '00000000-0000-4000-8000-000000000806', 'tr', 'name', 'İyi Niyet İkramı'),
  ('00000000-0000-4000-8000-000000000002', 'reason_code', '00000000-0000-4000-8000-000000000806', 'en', 'name', 'Goodwill Comp'),
  ('00000000-0000-4000-8000-000000000002', 'reason_code', '00000000-0000-4000-8000-000000000807', 'tr', 'name', 'Müşteri Şikayeti'),
  ('00000000-0000-4000-8000-000000000002', 'reason_code', '00000000-0000-4000-8000-000000000807', 'en', 'name', 'Customer Complaint'),
  ('00000000-0000-4000-8000-000000000003', 'call_type', '00000000-0000-4000-8000-000000000708', 'tr', 'name', 'Hesap İstiyorum'),
  ('00000000-0000-4000-8000-000000000003', 'call_type', '00000000-0000-4000-8000-000000000709', 'tr', 'name', 'Yardım İstiyorum')
on conflict (entity_type, entity_id, locale, field) do nothing;

-- Demo masalar + QR'lar (Faz 1): ham token'lar yalnızca lokalde, testlerin
-- deterministik hedefleyebilmesi için sabit ve dokümante edilir (password123
-- ile aynı "yalnızca lokal" deseni) — production seed'i böyle sabit token
-- kullanmaz. Hash, pgcrypto'nun digest()'iyle hesaplanır; ham token DB'de
-- hiçbir yerde saklanmaz.
insert into public.tables (id, tenant_id, branch_id, label, qr_token_hash)
values
  ('00000000-0000-4000-8000-000000000501', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011', 'Masa 1', encode(digest('demo-acme-table-1', 'sha256'), 'hex')),
  ('00000000-0000-4000-8000-000000000502', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011', 'Masa 2', encode(digest('demo-acme-table-2', 'sha256'), 'hex')),
  ('00000000-0000-4000-8000-000000000503', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011', 'Masa 3', encode(digest('demo-acme-table-3', 'sha256'), 'hex')),
  -- Masa 4/5: yalnızca E2E test izolasyonu için (paralel test dosyaları aynı
  -- masayı paylaşınca table_session çakışması olmasın diye ayrı masalar).
  ('00000000-0000-4000-8000-000000000505', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011', 'Masa 4', encode(digest('demo-acme-table-4', 'sha256'), 'hex')),
  ('00000000-0000-4000-8000-000000000506', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011', 'Masa 5', encode(digest('demo-acme-table-5', 'sha256'), 'hex')),
  ('00000000-0000-4000-8000-000000000504', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000012', 'Masa 1', encode(digest('demo-beta-table-1', 'sha256'), 'hex')),
  ('00000000-0000-4000-8000-000000000507', '00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000013', 'Masa 1', encode(digest('demo-gamma-table-1', 'sha256'), 'hex'))
on conflict (id) do nothing;

insert into public.generic_qr_codes (id, tenant_id, branch_id, label, qr_token_hash)
values
  ('00000000-0000-4000-8000-000000000601', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011', 'Genel QR', encode(digest('demo-acme-generic', 'sha256'), 'hex')),
  ('00000000-0000-4000-8000-000000000602', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000012', 'Genel QR', encode(digest('demo-beta-generic', 'sha256'), 'hex')),
  ('00000000-0000-4000-8000-000000000603', '00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000013', 'Genel QR', encode(digest('demo-gamma-generic', 'sha256'), 'hex'))
on conflict (id) do nothing;

-- Demo owner girişleri (yalnızca lokal geliştirme): auth.users + auth.identities
-- doğrudan SQL ile seed edilir — Faz 0'da self-servis kayıt akışı yok
-- (o, Faz 2/13 onboarding'inin kapsamı), Faz 0 sadece auth altyapısını
-- (custom_access_token_hook, RLS) elle test edilebilir kılar.
-- Şifre: password123 (sadece lokal — production seed'i asla bu deseni kullanmaz).
-- GoTrue'nun Go SQL sürücüsü bu token kolonlarını NULL değil boş string
-- bekler (NULL scan hatası verir) — confirmation_token vb. hepsi '' olmalı.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  phone_change, phone_change_token, email_change_token_current, reauthentication_token
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-4000-8000-0000000000a1',
    'authenticated', 'authenticated', 'owner@acme.test',
    crypt('password123', gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}', '{}',
    now(), now(),
    '', '', '', '', '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-4000-8000-0000000000b1',
    'authenticated', 'authenticated', 'owner@beta.test',
    crypt('password123', gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}', '{}',
    now(), now(),
    '', '', '', '', '', '', '', ''
  ),
  -- İzin sınırı testleri için (Faz 1 Adım 5): manager session.move'a sahip,
  -- waiter değil (role_permissions'a hiç satır eklenmez — fail-closed).
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-4000-8000-0000000000a2',
    'authenticated', 'authenticated', 'manager@acme.test',
    crypt('password123', gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}', '{}',
    now(), now(),
    '', '', '', '', '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-4000-8000-0000000000a3',
    'authenticated', 'authenticated', 'waiter@acme.test',
    crypt('password123', gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}', '{}',
    now(), now(),
    '', '', '', '', '', '', '', ''
  ),
  -- gamma owner: onboarding sihirbazının test edileceği hesap.
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-4000-8000-0000000000c1',
    'authenticated', 'authenticated', 'owner@gamma.test',
    crypt('password123', gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}', '{}',
    now(), now(),
    '', '', '', '', '', '', '', ''
  ),
  -- Faz 4 Adım 0: Süper Admin — tenant'a hiç bağlı değil, platform_admins'e
  -- eklenerek custom_access_token_hook'un üçüncü dalını tetikler.
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-4000-8000-0000000000d1',
    'authenticated', 'authenticated', 'platform@rkys.test',
    crypt('password123', gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}', '{}',
    now(), now(),
    '', '', '', '', '', '', '', ''
  )
on conflict (id) do nothing;

insert into auth.identities (id, provider_id, user_id, identity_data, provider, created_at, updated_at)
values
  (
    gen_random_uuid(), '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000a1',
    '{"sub":"00000000-0000-4000-8000-0000000000a1","email":"owner@acme.test"}', 'email', now(), now()
  ),
  (
    gen_random_uuid(), '00000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-0000000000a2',
    '{"sub":"00000000-0000-4000-8000-0000000000a2","email":"manager@acme.test"}', 'email', now(), now()
  ),
  (
    gen_random_uuid(), '00000000-0000-4000-8000-0000000000a3', '00000000-0000-4000-8000-0000000000a3',
    '{"sub":"00000000-0000-4000-8000-0000000000a3","email":"waiter@acme.test"}', 'email', now(), now()
  ),
  (
    gen_random_uuid(), '00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000b1',
    '{"sub":"00000000-0000-4000-8000-0000000000b1","email":"owner@beta.test"}', 'email', now(), now()
  ),
  (
    gen_random_uuid(), '00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-0000000000c1',
    '{"sub":"00000000-0000-4000-8000-0000000000c1","email":"owner@gamma.test"}', 'email', now(), now()
  ),
  (
    gen_random_uuid(), '00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000000d1',
    '{"sub":"00000000-0000-4000-8000-0000000000d1","email":"platform@rkys.test"}', 'email', now(), now()
  )
on conflict (provider_id, provider) do nothing;

-- Ad/soyad Faz 23'te eklendi (0091): personel listesi tabloya alınabilsin
-- diye satırın bir KİMLİK kolonu gerekiyordu. D90 kural 2 gereği hiçbir ad
-- tekrar etmiyor.
insert into public.profiles (id, tenant_id, role, is_active, full_name)
values
  ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000001', 'owner', true, 'Tolga Acar'),
  ('00000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-000000000001', 'manager', true, 'Elif Demir'),
  ('00000000-0000-4000-8000-0000000000a3', '00000000-0000-4000-8000-000000000001', 'waiter', true, 'Kerem Yıldız'),
  ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-000000000002', 'owner', true, 'Selin Kaya'),
  ('00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-000000000003', 'owner', true, 'Murat Şahin')
on conflict (id) do update set full_name = excluded.full_name;

insert into public.platform_admins (id, is_active)
values ('00000000-0000-4000-8000-0000000000d1', true)
on conflict (id) do nothing;

-- Demo veri genişletmesi (bug-hunt 2026-08-01): Faz 11+ ile eklenen
-- modüllerin (rezervasyon, kiosk, personel vardiyası, envanter, sadakat,
-- teslimat bölgesi) admin panelinde boş görünmemesi için. acme'de ilgili
-- modüller açılır (varsayılan kapalı kalan yukarıdaki cross-join'in
-- üstüne); beta "kapalı modül" ve gamma "taze onboarding" örneklerini
-- göstermeye devam etsin diye onlara dokunulmaz. staff_shifts profiles'a
-- FK verdiği için bu blok, profiles insert'inden SONRA, dosyanın en
-- sonunda yer alır.
update public.tenant_modules set is_enabled = true
where tenant_id = '00000000-0000-4000-8000-000000000001'
  and module_key in ('reservations', 'kiosk', 'staff_scheduling', 'inventory', 'recipes', 'crm_loyalty', 'delivery');

insert into public.table_zones (id, tenant_id, branch_id, name, display_order)
values
  ('00000000-0000-4000-8000-000000000901', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011', 'İç Mekan', 0),
  ('00000000-0000-4000-8000-000000000902', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011', 'Bahçe', 1)
on conflict (id) do nothing;

update public.tables set zone_id = '00000000-0000-4000-8000-000000000901' where id = '00000000-0000-4000-8000-000000000501';
update public.tables set zone_id = '00000000-0000-4000-8000-000000000902' where id = '00000000-0000-4000-8000-000000000502';

insert into public.reservations (id, tenant_id, branch_id, table_id, customer_name, customer_phone, party_size, reserved_at, status)
values
  ('00000000-0000-4000-8000-000000000911', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000501', 'Ahmet Yılmaz', '+905551112233', 4, now() + interval '1 day', 'confirmed'),
  ('00000000-0000-4000-8000-000000000912', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011', null, 'Zeynep Kaya', '+905552223344', 2, now() + interval '2 days', 'pending')
on conflict (id) do nothing;

insert into public.waitlist_entries (id, tenant_id, branch_id, customer_name, customer_phone, party_size, status)
values
  ('00000000-0000-4000-8000-000000000921', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011', 'Mehmet Demir', '+905553334455', 3, 'waiting')
on conflict (id) do nothing;

insert into public.kiosk_devices (id, tenant_id, branch_id, device_name, pairing_code, is_active)
values
  ('00000000-0000-4000-8000-000000000931', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011', 'Giriş Kiosk', 'DEMO-ACME-K1', true)
on conflict (tenant_id, pairing_code) do nothing;

insert into public.staff_shifts (id, tenant_id, branch_id, profile_id, shift_date, start_time, end_time)
values
  ('00000000-0000-4000-8000-000000000941', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-0000000000a2', current_date, '09:00', '17:00'),
  ('00000000-0000-4000-8000-000000000942', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-0000000000a3', current_date, '12:00', '20:00')
on conflict (id) do nothing;

insert into public.customers (id, tenant_id, phone, kvkk_consented_at)
values
  ('00000000-0000-4000-8000-000000000961', '00000000-0000-4000-8000-000000000001', '+905554445566', now())
on conflict (id) do nothing;

insert into public.loyalty_programs (tenant_id, mode, config, is_active)
values
  ('00000000-0000-4000-8000-000000000001', 'stamp', '{"stampsRequired":10}'::jsonb, true)
on conflict (tenant_id) do nothing;

insert into public.ingredients (id, tenant_id, name, unit, critical_level, current_stock, avg_cost_minor_per_unit)
values
  ('00000000-0000-4000-8000-000000000971', '00000000-0000-4000-8000-000000000001', 'Süt', 'l', 5, 20, 1500),
  ('00000000-0000-4000-8000-000000000972', '00000000-0000-4000-8000-000000000001', 'Kahve Çekirdeği', 'kg', 2, 8, 25000)
on conflict (id) do nothing;

insert into public.suppliers (id, tenant_id, name, contact_info)
values
  ('00000000-0000-4000-8000-000000000981', '00000000-0000-4000-8000-000000000001', 'Anadolu Gıda Toptan', '+905005006070')
on conflict (id) do nothing;

insert into public.delivery_zones (id, tenant_id, branch_id, name, fee_minor, min_basket_minor)
values
  ('00000000-0000-4000-8000-000000000991', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011', 'Merkez Bölge', 1500, 10000)
on conflict (id) do nothing;
-- ═══════════════════════════════════════════════════════════════════════
-- Faz 21 demo veri genişletmesi (2026-08-03)
--
-- Gerekçe: yeni önyüz (kanban KDS, kategori şeridi, admin listeleri) üç
-- kategorili / üç ürünlü bir katalogla gerçekçi görünmüyordu; ekranların
-- yoğunluk ritmi ancak gerçek boyutta bir menüyle değerlendirilebiliyor.
--
-- Kural: bu blok TAMAMEN EKLEYİCİDİR. Mevcut satırların id'si, adı ve
-- display_order'ı DEĞİŞTİRİLMEZ — 11 E2E dosyası "Filtre Kahve"ye,
-- menu-reorder.spec.ts "İçecekler"in "Tatlılar" ile KOMŞU olmasına bağlı
-- (bu yüzden yeni kategoriler display_order 2'den başlar).
--
-- Ad tekrarı yok: hiçbir ürün/kategori adı ne kendi tenant'ında ne de
-- diğer tenant'larda ikinci kez geçmez.
--
-- Dokunulmayanlar: Filtre Kahve (201) varyantsız/ekstrasız kalır — POS ve
-- misafir menüsü testleri onu doğrudan sepete ekliyor, varyant eklemek
-- akışa bir seçim adımı sokardı. gamma tenant'ı taze onboarding demosu
-- olduğu için hiç genişletilmez.
-- ═══════════════════════════════════════════════════════════════════════

-- İstasyonlar: KDS istasyon filtresi acme'de de denenebilsin diye mevcut
-- iki kategoriye de atanır (S28 kendi tenant'ını kurduğu için etkilenmez).
update public.menu_categories set station = 'bar'     where id = '00000000-0000-4000-8000-000000000101';
update public.menu_categories set station = 'pastane' where id = '00000000-0000-4000-8000-000000000102';

insert into public.menu_categories (id, tenant_id, layout, station, display_order)
values
  ('00000000-0000-4000-8000-000000000105', '00000000-0000-4000-8000-000000000001', 'grid',     'mutfak',  2),
  ('00000000-0000-4000-8000-000000000106', '00000000-0000-4000-8000-000000000001', 'list',     'mutfak',  3),
  ('00000000-0000-4000-8000-000000000107', '00000000-0000-4000-8000-000000000001', 'showcase', 'mutfak',  4),
  ('00000000-0000-4000-8000-000000000108', '00000000-0000-4000-8000-000000000001', 'list',     'bar',     5),
  ('00000000-0000-4000-8000-000000000109', '00000000-0000-4000-8000-000000000002', 'list',     null,      1)
on conflict (id) do nothing;

insert into public.products (id, tenant_id, category_id, track_mode, base_price_minor, stock_quantity, is_sold_out, display_order)
values
  -- acme · İçecekler (101)
  ('00000000-0000-4000-8000-000000000206', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', 'simple',   7500, null, false, 2),
  ('00000000-0000-4000-8000-000000000207', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', 'simple',  11000, null, false, 3),
  -- acme · Kahvaltı (105)
  ('00000000-0000-4000-8000-000000000208', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000105', 'simple',  38000, null, false, 0),
  ('00000000-0000-4000-8000-000000000209', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000105', 'simple',  16500, null, false, 1),
  -- acme · Sandviç & Tost (106)
  ('00000000-0000-4000-8000-000000000210', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000106', 'simple',  13500, null, false, 0),
  ('00000000-0000-4000-8000-000000000211', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000106', 'simple',  19500, null, false, 1),
  -- acme · Salatalar (107) — 212 stok takipli (stock_quantity dolu), böylece
  -- "stok azaldı / tükendi" yolu Cheesecake dışında da görünür. track_mode
  -- yalnızca 'simple' | 'recipe' olabilir (0009_menu_schema.sql).
  ('00000000-0000-4000-8000-000000000212', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000107', 'simple',    22000,   7, false, 0),
  ('00000000-0000-4000-8000-000000000213', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000107', 'simple',    20500, null, false, 1),
  -- acme · Bitki Çayları (108)
  ('00000000-0000-4000-8000-000000000214', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000108', 'simple',   6000, null, false, 0),
  ('00000000-0000-4000-8000-000000000215', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000108', 'simple',   6500, null, false, 1),
  ('00000000-0000-4000-8000-000000000216', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000108', 'simple',   6500, null, false, 2),
  -- acme · Tatlılar (102)
  ('00000000-0000-4000-8000-000000000217', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000102', 'simple',  14500, null, false, 1),
  ('00000000-0000-4000-8000-000000000218', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000102', 'simple',  11500, null, false, 2),
  -- beta · Ana Yemekler (103) + Fırın Tatlıları (109)
  ('00000000-0000-4000-8000-000000000219', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000103', 'simple',  28000, null, false, 1),
  ('00000000-0000-4000-8000-000000000220', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000103', 'simple',  24500, null, false, 2),
  ('00000000-0000-4000-8000-000000000221', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000109', 'simple',  13000, null, false, 0),
  ('00000000-0000-4000-8000-000000000222', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000109', 'simple',   9500, null, false, 1)
on conflict (id) do nothing;

insert into public.product_variants (id, tenant_id, product_id, price_minor, display_order)
values
  -- Türk Kahvesi: şeker tercihi (aynı fiyat) — varyantın "fiyat değiştirmek
  -- zorunda değil" ucunu gösterir.
  ('00000000-0000-4000-8000-000000000303', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000206', 7500, 0),
  ('00000000-0000-4000-8000-000000000304', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000206', 7500, 1),
  ('00000000-0000-4000-8000-000000000305', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000206', 7500, 2),
  -- Cold Brew: hacme göre fiyat
  ('00000000-0000-4000-8000-000000000306', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000207', 11000, 0),
  ('00000000-0000-4000-8000-000000000307', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000207', 14000, 1)
on conflict (id) do nothing;

insert into public.product_extras (id, tenant_id, product_id, price_minor, display_order)
values
  ('00000000-0000-4000-8000-000000000403', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000202', 2000, 0),
  ('00000000-0000-4000-8000-000000000404', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000202', 1500, 1),
  ('00000000-0000-4000-8000-000000000405', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000202', 2500, 2),
  ('00000000-0000-4000-8000-000000000406', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000210', 3000, 0),
  ('00000000-0000-4000-8000-000000000407', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000210', 1000, 1)
on conflict (id) do nothing;

-- Çeviriler: acme ve beta iki dilli (tr + en), gamma tek dilli. Adların
-- hiçbiri bir başkasının alt dizesi değil — `getByText(..., {exact:true})`
-- kullanan testlerin yanı sıra kesin olmayan eşleşmeler de tekil kalsın
-- ("San Sebastian Tart", bilerek "Cheesecake" içermiyor).
insert into public.content_translations (tenant_id, entity_type, entity_id, locale, field, value)
values
  -- kategoriler
  ('00000000-0000-4000-8000-000000000001', 'menu_category', '00000000-0000-4000-8000-000000000105', 'tr', 'name', 'Kahvaltı'),
  ('00000000-0000-4000-8000-000000000001', 'menu_category', '00000000-0000-4000-8000-000000000105', 'en', 'name', 'Breakfast'),
  ('00000000-0000-4000-8000-000000000001', 'menu_category', '00000000-0000-4000-8000-000000000106', 'tr', 'name', 'Sandviç & Tost'),
  ('00000000-0000-4000-8000-000000000001', 'menu_category', '00000000-0000-4000-8000-000000000106', 'en', 'name', 'Sandwiches & Toasties'),
  ('00000000-0000-4000-8000-000000000001', 'menu_category', '00000000-0000-4000-8000-000000000107', 'tr', 'name', 'Salatalar'),
  ('00000000-0000-4000-8000-000000000001', 'menu_category', '00000000-0000-4000-8000-000000000107', 'en', 'name', 'Salads'),
  ('00000000-0000-4000-8000-000000000001', 'menu_category', '00000000-0000-4000-8000-000000000108', 'tr', 'name', 'Bitki Çayları'),
  ('00000000-0000-4000-8000-000000000001', 'menu_category', '00000000-0000-4000-8000-000000000108', 'en', 'name', 'Herbal Teas'),
  ('00000000-0000-4000-8000-000000000002', 'menu_category', '00000000-0000-4000-8000-000000000109', 'tr', 'name', 'Fırın Tatlıları'),
  ('00000000-0000-4000-8000-000000000002', 'menu_category', '00000000-0000-4000-8000-000000000109', 'en', 'name', 'Bakery Desserts'),
  -- acme ürünleri
  ('00000000-0000-4000-8000-000000000001', 'product', '00000000-0000-4000-8000-000000000206', 'tr', 'name', 'Türk Kahvesi'),
  ('00000000-0000-4000-8000-000000000001', 'product', '00000000-0000-4000-8000-000000000206', 'en', 'name', 'Turkish Coffee'),
  ('00000000-0000-4000-8000-000000000001', 'product', '00000000-0000-4000-8000-000000000207', 'tr', 'name', 'Cold Brew'),
  ('00000000-0000-4000-8000-000000000001', 'product', '00000000-0000-4000-8000-000000000207', 'en', 'name', 'Cold Brew'),
  ('00000000-0000-4000-8000-000000000001', 'product', '00000000-0000-4000-8000-000000000208', 'tr', 'name', 'Serpme Kahvaltı'),
  ('00000000-0000-4000-8000-000000000001', 'product', '00000000-0000-4000-8000-000000000208', 'en', 'name', 'Breakfast Platter'),
  ('00000000-0000-4000-8000-000000000001', 'product', '00000000-0000-4000-8000-000000000209', 'tr', 'name', 'Menemen'),
  ('00000000-0000-4000-8000-000000000001', 'product', '00000000-0000-4000-8000-000000000209', 'en', 'name', 'Menemen'),
  ('00000000-0000-4000-8000-000000000001', 'product', '00000000-0000-4000-8000-000000000210', 'tr', 'name', 'Kaşarlı Tost'),
  ('00000000-0000-4000-8000-000000000001', 'product', '00000000-0000-4000-8000-000000000210', 'en', 'name', 'Cheese Toastie'),
  ('00000000-0000-4000-8000-000000000001', 'product', '00000000-0000-4000-8000-000000000211', 'tr', 'name', 'Kulüp Sandviç'),
  ('00000000-0000-4000-8000-000000000001', 'product', '00000000-0000-4000-8000-000000000211', 'en', 'name', 'Club Sandwich'),
  ('00000000-0000-4000-8000-000000000001', 'product', '00000000-0000-4000-8000-000000000212', 'tr', 'name', 'Sezar Salata'),
  ('00000000-0000-4000-8000-000000000001', 'product', '00000000-0000-4000-8000-000000000212', 'en', 'name', 'Caesar Salad'),
  ('00000000-0000-4000-8000-000000000001', 'product', '00000000-0000-4000-8000-000000000213', 'tr', 'name', 'Akdeniz Salata'),
  ('00000000-0000-4000-8000-000000000001', 'product', '00000000-0000-4000-8000-000000000213', 'en', 'name', 'Mediterranean Salad'),
  ('00000000-0000-4000-8000-000000000001', 'product', '00000000-0000-4000-8000-000000000214', 'tr', 'name', 'Ihlamur'),
  ('00000000-0000-4000-8000-000000000001', 'product', '00000000-0000-4000-8000-000000000214', 'en', 'name', 'Linden Tea'),
  ('00000000-0000-4000-8000-000000000001', 'product', '00000000-0000-4000-8000-000000000215', 'tr', 'name', 'Nane Limon'),
  ('00000000-0000-4000-8000-000000000001', 'product', '00000000-0000-4000-8000-000000000215', 'en', 'name', 'Mint & Lemon'),
  ('00000000-0000-4000-8000-000000000001', 'product', '00000000-0000-4000-8000-000000000216', 'tr', 'name', 'Yeşil Çay'),
  ('00000000-0000-4000-8000-000000000001', 'product', '00000000-0000-4000-8000-000000000216', 'en', 'name', 'Green Tea'),
  ('00000000-0000-4000-8000-000000000001', 'product', '00000000-0000-4000-8000-000000000217', 'tr', 'name', 'San Sebastian'),
  ('00000000-0000-4000-8000-000000000001', 'product', '00000000-0000-4000-8000-000000000217', 'en', 'name', 'San Sebastian Tart'),
  ('00000000-0000-4000-8000-000000000001', 'product', '00000000-0000-4000-8000-000000000218', 'tr', 'name', 'Brownie'),
  ('00000000-0000-4000-8000-000000000001', 'product', '00000000-0000-4000-8000-000000000218', 'en', 'name', 'Brownie'),
  -- beta ürünleri
  ('00000000-0000-4000-8000-000000000002', 'product', '00000000-0000-4000-8000-000000000219', 'tr', 'name', 'Kuzu Şiş'),
  ('00000000-0000-4000-8000-000000000002', 'product', '00000000-0000-4000-8000-000000000219', 'en', 'name', 'Lamb Skewer'),
  ('00000000-0000-4000-8000-000000000002', 'product', '00000000-0000-4000-8000-000000000220', 'tr', 'name', 'Tavuk Izgara'),
  ('00000000-0000-4000-8000-000000000002', 'product', '00000000-0000-4000-8000-000000000220', 'en', 'name', 'Grilled Chicken'),
  ('00000000-0000-4000-8000-000000000002', 'product', '00000000-0000-4000-8000-000000000221', 'tr', 'name', 'Künefe'),
  ('00000000-0000-4000-8000-000000000002', 'product', '00000000-0000-4000-8000-000000000221', 'en', 'name', 'Kunefe'),
  ('00000000-0000-4000-8000-000000000002', 'product', '00000000-0000-4000-8000-000000000222', 'tr', 'name', 'Sütlaç'),
  ('00000000-0000-4000-8000-000000000002', 'product', '00000000-0000-4000-8000-000000000222', 'en', 'name', 'Rice Pudding'),
  -- varyantlar
  ('00000000-0000-4000-8000-000000000001', 'product_variant', '00000000-0000-4000-8000-000000000303', 'tr', 'name', 'Sade'),
  ('00000000-0000-4000-8000-000000000001', 'product_variant', '00000000-0000-4000-8000-000000000303', 'en', 'name', 'Unsweetened'),
  ('00000000-0000-4000-8000-000000000001', 'product_variant', '00000000-0000-4000-8000-000000000304', 'tr', 'name', 'Orta Şekerli'),
  ('00000000-0000-4000-8000-000000000001', 'product_variant', '00000000-0000-4000-8000-000000000304', 'en', 'name', 'Medium Sweet'),
  ('00000000-0000-4000-8000-000000000001', 'product_variant', '00000000-0000-4000-8000-000000000305', 'tr', 'name', 'Çok Şekerli'),
  ('00000000-0000-4000-8000-000000000001', 'product_variant', '00000000-0000-4000-8000-000000000305', 'en', 'name', 'Extra Sweet'),
  ('00000000-0000-4000-8000-000000000001', 'product_variant', '00000000-0000-4000-8000-000000000306', 'tr', 'name', '250 ml'),
  ('00000000-0000-4000-8000-000000000001', 'product_variant', '00000000-0000-4000-8000-000000000306', 'en', 'name', '250 ml'),
  ('00000000-0000-4000-8000-000000000001', 'product_variant', '00000000-0000-4000-8000-000000000307', 'tr', 'name', '400 ml'),
  ('00000000-0000-4000-8000-000000000001', 'product_variant', '00000000-0000-4000-8000-000000000307', 'en', 'name', '400 ml'),
  -- ekstralar
  ('00000000-0000-4000-8000-000000000001', 'product_extra', '00000000-0000-4000-8000-000000000403', 'tr', 'name', 'Ekstra Shot'),
  ('00000000-0000-4000-8000-000000000001', 'product_extra', '00000000-0000-4000-8000-000000000403', 'en', 'name', 'Extra Shot'),
  ('00000000-0000-4000-8000-000000000001', 'product_extra', '00000000-0000-4000-8000-000000000404', 'tr', 'name', 'Vanilya Şurubu'),
  ('00000000-0000-4000-8000-000000000001', 'product_extra', '00000000-0000-4000-8000-000000000404', 'en', 'name', 'Vanilla Syrup'),
  ('00000000-0000-4000-8000-000000000001', 'product_extra', '00000000-0000-4000-8000-000000000405', 'tr', 'name', 'Yulaf Sütü'),
  ('00000000-0000-4000-8000-000000000001', 'product_extra', '00000000-0000-4000-8000-000000000405', 'en', 'name', 'Oat Milk'),
  ('00000000-0000-4000-8000-000000000001', 'product_extra', '00000000-0000-4000-8000-000000000406', 'tr', 'name', 'Sucuk'),
  ('00000000-0000-4000-8000-000000000001', 'product_extra', '00000000-0000-4000-8000-000000000406', 'en', 'name', 'Sujuk'),
  ('00000000-0000-4000-8000-000000000001', 'product_extra', '00000000-0000-4000-8000-000000000407', 'tr', 'name', 'Domates'),
  ('00000000-0000-4000-8000-000000000001', 'product_extra', '00000000-0000-4000-8000-000000000407', 'en', 'name', 'Tomato')
on conflict (entity_type, entity_id, locale, field) do nothing;

-- ── Salon: üçüncü bölge + 7 yeni masa ──────────────────────────────────
-- İSİMLENDİRME KISITI: yeni masalar "Masa 10".."Masa 15" olarak ADLANDIRILMAZ.
-- Playwright'ta `getByRole("option", { name: "Masa 1" })` varsayılan olarak
-- ALT DİZE eşler; "Masa 1" o durumda "Masa 10"u da yakalayıp strict mode
-- ihlali verirdi. Bölge adlarıyla genişletmek hem bu tuzağı atlatıyor hem de
-- bölge (zone) özelliğini demo edilebilir kılıyor.
insert into public.table_zones (id, tenant_id, branch_id, name, display_order)
values
  ('00000000-0000-4000-8000-000000000903', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011', 'Teras', 2)
on conflict (id) do nothing;

insert into public.tables (id, tenant_id, branch_id, label, zone_id, qr_token_hash)
values
  ('00000000-0000-4000-8000-000000000508', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011', 'Masa 6',   '00000000-0000-4000-8000-000000000901', encode(digest('demo-acme-table-6', 'sha256'), 'hex')),
  ('00000000-0000-4000-8000-000000000509', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011', 'Masa 7',   '00000000-0000-4000-8000-000000000901', encode(digest('demo-acme-table-7', 'sha256'), 'hex')),
  ('00000000-0000-4000-8000-00000000050a', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011', 'Bahçe 1',  '00000000-0000-4000-8000-000000000902', encode(digest('demo-acme-garden-1', 'sha256'), 'hex')),
  ('00000000-0000-4000-8000-00000000050b', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011', 'Bahçe 2',  '00000000-0000-4000-8000-000000000902', encode(digest('demo-acme-garden-2', 'sha256'), 'hex')),
  ('00000000-0000-4000-8000-00000000050c', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011', 'Bahçe 3',  '00000000-0000-4000-8000-000000000902', encode(digest('demo-acme-garden-3', 'sha256'), 'hex')),
  ('00000000-0000-4000-8000-00000000050d', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011', 'Teras 1',  '00000000-0000-4000-8000-000000000903', encode(digest('demo-acme-terrace-1', 'sha256'), 'hex')),
  ('00000000-0000-4000-8000-00000000050e', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011', 'Teras 2',  '00000000-0000-4000-8000-000000000903', encode(digest('demo-acme-terrace-2', 'sha256'), 'hex'))
on conflict (id) do nothing;

-- Masa 3-5 de bir bölgeye bağlanır; "bölgesiz masa" durumu Tezgâh'ta kalır.
update public.tables set zone_id = '00000000-0000-4000-8000-000000000901' where id = '00000000-0000-4000-8000-000000000503';
update public.tables set zone_id = '00000000-0000-4000-8000-000000000902' where id = '00000000-0000-4000-8000-000000000505';
update public.tables set zone_id = '00000000-0000-4000-8000-000000000903' where id = '00000000-0000-4000-8000-000000000506';

-- ── Operasyon demosu: rezervasyon, bekleme listesi, kiosk, vardiya ──────
insert into public.reservations (id, tenant_id, branch_id, table_id, customer_name, customer_phone, party_size, reserved_at, status, note)
values
  ('00000000-0000-4000-8000-000000000913', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000508', 'Elif Şahin',    '+905554445511', 6, now() + interval '3 hours', 'confirmed', 'Doğum günü, pasta getirilecek'),
  ('00000000-0000-4000-8000-000000000914', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-00000000050a', 'Burak Aydın',   '+905554445522', 2, now() + interval '1 day 2 hours', 'confirmed', null),
  ('00000000-0000-4000-8000-000000000915', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011', null,                                   'Selin Arslan',  '+905554445533', 8, now() + interval '4 days', 'pending', 'Kurumsal yemek, fatura kesilecek'),
  ('00000000-0000-4000-8000-000000000916', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-00000000050d', 'Deniz Koç',     '+905554445544', 4, now() - interval '2 days', 'cancelled', null)
on conflict (id) do nothing;

insert into public.waitlist_entries (id, tenant_id, branch_id, customer_name, customer_phone, party_size, status)
values
  ('00000000-0000-4000-8000-000000000922', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011', 'Ceren Polat', '+905553334466', 2, 'waiting'),
  ('00000000-0000-4000-8000-000000000923', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011', 'Emre Doğan',  '+905553334477', 5, 'waiting')
on conflict (id) do nothing;

insert into public.kiosk_devices (id, tenant_id, branch_id, device_name, pairing_code, is_active)
values
  ('00000000-0000-4000-8000-000000000932', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011', 'Bahçe Kiosk', 'DEMO-ACME-K2', true)
on conflict (tenant_id, pairing_code) do nothing;

-- Vardiya çizelgesi: yarın ve öbür gün de dolu olsun ki haftalık görünüm
-- tek günlük bir şeritten ibaret kalmasın.
insert into public.staff_shifts (id, tenant_id, branch_id, profile_id, shift_date, start_time, end_time)
values
  ('00000000-0000-4000-8000-000000000943', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-0000000000a2', current_date + 1, '09:00', '17:00'),
  ('00000000-0000-4000-8000-000000000944', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-0000000000a3', current_date + 1, '16:00', '00:00'),
  ('00000000-0000-4000-8000-000000000945', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-0000000000a1', current_date + 2, '10:00', '18:00'),
  ('00000000-0000-4000-8000-000000000946', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-0000000000a3', current_date + 2, '12:00', '20:00')
on conflict (id) do nothing;

insert into public.customers (id, tenant_id, phone, kvkk_consented_at)
values
  ('00000000-0000-4000-8000-000000000962', '00000000-0000-4000-8000-000000000001', '+905554445577', now() - interval '30 days'),
  ('00000000-0000-4000-8000-000000000963', '00000000-0000-4000-8000-000000000001', '+905554445588', now() - interval '12 days'),
  ('00000000-0000-4000-8000-000000000964', '00000000-0000-4000-8000-000000000001', '+905554445599', now() - interval '3 days'),
  ('00000000-0000-4000-8000-000000000965', '00000000-0000-4000-8000-000000000001', '+905554445600', now())
on conflict (id) do nothing;

-- ── Envanter: kritik seviyenin ALTINA düşmüş kalemler dahil ─────────────
-- "Kritik stok" uyarısının boş görünmemesi için iki kalem bilerek eşiğin
-- altında (Kaşar, Un) — uyarı rozetinin gerçek veriyle çalıştığı görülür.
insert into public.ingredients (id, tenant_id, name, unit, critical_level, current_stock, avg_cost_minor_per_unit)
values
  ('00000000-0000-4000-8000-000000000973', '00000000-0000-4000-8000-000000000001', 'Kaşar Peyniri',  'kg',  3,   1.5,  32000),
  ('00000000-0000-4000-8000-000000000974', '00000000-0000-4000-8000-000000000001', 'Un',             'kg', 10,   6,     2500),
  ('00000000-0000-4000-8000-000000000975', '00000000-0000-4000-8000-000000000001', 'Yumurta',        'adet', 60, 180,    450),
  ('00000000-0000-4000-8000-000000000976', '00000000-0000-4000-8000-000000000001', 'Domates',        'kg',  8,  22,     4000),
  ('00000000-0000-4000-8000-000000000977', '00000000-0000-4000-8000-000000000001', 'Tereyağı',       'kg',  4,   9,    38000),
  ('00000000-0000-4000-8000-000000000978', '00000000-0000-4000-8000-000000000001', 'Yulaf Sütü',     'l',   6,  14,     6500)
on conflict (id) do nothing;

insert into public.suppliers (id, tenant_id, name, contact_info)
values
  ('00000000-0000-4000-8000-000000000982', '00000000-0000-4000-8000-000000000001', 'Ege Süt Ürünleri', '+905005006071'),
  ('00000000-0000-4000-8000-000000000983', '00000000-0000-4000-8000-000000000001', 'Marmara Kahve İthalat', '+905005006072')
on conflict (id) do nothing;

insert into public.delivery_zones (id, tenant_id, branch_id, name, fee_minor, min_basket_minor)
values
  ('00000000-0000-4000-8000-000000000992', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011', 'Kuzey Mahalleleri', 2500, 15000),
  ('00000000-0000-4000-8000-000000000993', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011', 'Sahil Hattı',       3500, 20000)
on conflict (id) do nothing;

-- ── Reçeteler: maliyet/kâr marjı sayfaları gerçek veriyle çalışsın ──────
insert into public.recipes (id, tenant_id, product_id)
values
  ('00000000-0000-4000-8000-0000000009a1', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000202'),
  ('00000000-0000-4000-8000-0000000009a2', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000206'),
  ('00000000-0000-4000-8000-0000000009a3', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000210'),
  ('00000000-0000-4000-8000-0000000009a4', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000209')
on conflict (id) do nothing;

insert into public.recipe_items (tenant_id, recipe_id, ingredient_id, quantity_per_unit)
values
  -- Latte: 0.2 l süt + 0.018 kg çekirdek
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000009a1', '00000000-0000-4000-8000-000000000971', 0.2),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000009a1', '00000000-0000-4000-8000-000000000972', 0.018),
  -- Türk Kahvesi: 0.012 kg çekirdek
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000009a2', '00000000-0000-4000-8000-000000000972', 0.012),
  -- Kaşarlı Tost: kaşar + un(ekmek) + tereyağı
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000009a3', '00000000-0000-4000-8000-000000000973', 0.08),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000009a3', '00000000-0000-4000-8000-000000000974', 0.12),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000009a3', '00000000-0000-4000-8000-000000000977', 0.01),
  -- Menemen: yumurta + domates + tereyağı
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000009a4', '00000000-0000-4000-8000-000000000975', 3),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000009a4', '00000000-0000-4000-8000-000000000976', 0.15),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000009a4', '00000000-0000-4000-8000-000000000977', 0.015)
on conflict (recipe_id, ingredient_id) do nothing;

-- ── Ürün açıklamaları (Faz 22) ─────────────────────────────────────────
-- Açıklama zaten desteklenen bir alandı (content_translations.field =
-- 'description'; admin menü formu yazıyor, onboarding şablonları seed'liyor)
-- ama BU seed'in kendi kataloğunda hiç yoktu ve misafir tarafı da onu
-- okumuyordu. İkisi birden kapatıldı; demo menüde artık her ürünün
-- "içinde ne var" bilgisi var.
insert into public.content_translations (tenant_id, entity_type, entity_id, locale, field, value)
values
  ('00000000-0000-4000-8000-000000000001', 'product', '00000000-0000-4000-8000-000000000201', 'tr', 'description', 'Orta kavrulmuş çekirdekten, günlük demlenen filtre kahve.'),
  ('00000000-0000-4000-8000-000000000001', 'product', '00000000-0000-4000-8000-000000000201', 'en', 'description', 'Freshly brewed daily from medium-roast beans.'),
  ('00000000-0000-4000-8000-000000000001', 'product', '00000000-0000-4000-8000-000000000202', 'tr', 'description', 'Çift shot espresso ve buharlanmış süt; küçük veya büyük boy.'),
  ('00000000-0000-4000-8000-000000000001', 'product', '00000000-0000-4000-8000-000000000202', 'en', 'description', 'Double espresso with steamed milk; small or large.'),
  ('00000000-0000-4000-8000-000000000001', 'product', '00000000-0000-4000-8000-000000000203', 'tr', 'description', 'Fırında pişmiş klasik cheesecake, bisküvi tabanı üzerinde.'),
  ('00000000-0000-4000-8000-000000000001', 'product', '00000000-0000-4000-8000-000000000203', 'en', 'description', 'Classic baked cheesecake on a biscuit base.'),
  ('00000000-0000-4000-8000-000000000001', 'product', '00000000-0000-4000-8000-000000000206', 'tr', 'description', 'Bakır cezvede pişirilen geleneksel Türk kahvesi, lokum ile.'),
  ('00000000-0000-4000-8000-000000000001', 'product', '00000000-0000-4000-8000-000000000206', 'en', 'description', 'Traditional Turkish coffee brewed in a copper pot, served with lokum.'),
  ('00000000-0000-4000-8000-000000000001', 'product', '00000000-0000-4000-8000-000000000207', 'tr', 'description', 'On iki saat soğuk demlenmiş, düşük asiditeli kahve.'),
  ('00000000-0000-4000-8000-000000000001', 'product', '00000000-0000-4000-8000-000000000207', 'en', 'description', 'Steeped cold for twelve hours; smooth and low in acidity.'),
  ('00000000-0000-4000-8000-000000000001', 'product', '00000000-0000-4000-8000-000000000208', 'tr', 'description', 'İki kişilik; peynir çeşitleri, zeytin, reçel, tereyağı, bal ve sınırsız çay.'),
  ('00000000-0000-4000-8000-000000000001', 'product', '00000000-0000-4000-8000-000000000208', 'en', 'description', 'Serves two; cheeses, olives, jam, butter, honey and unlimited tea.'),
  ('00000000-0000-4000-8000-000000000001', 'product', '00000000-0000-4000-8000-000000000209', 'tr', 'description', 'Domates, yeşil biber ve yumurta; tereyağında pişirilir.'),
  ('00000000-0000-4000-8000-000000000001', 'product', '00000000-0000-4000-8000-000000000209', 'en', 'description', 'Tomato, green pepper and egg, cooked in butter.'),
  ('00000000-0000-4000-8000-000000000001', 'product', '00000000-0000-4000-8000-000000000210', 'tr', 'description', 'Tam buğday ekmekte kaşar peyniri; sucuk veya domates eklenebilir.'),
  ('00000000-0000-4000-8000-000000000001', 'product', '00000000-0000-4000-8000-000000000210', 'en', 'description', 'Melted cheese on wholewheat bread; add sujuk or tomato.'),
  ('00000000-0000-4000-8000-000000000001', 'product', '00000000-0000-4000-8000-000000000211', 'tr', 'description', 'Izgara tavuk, marul, domates ve patates kızartması ile.'),
  ('00000000-0000-4000-8000-000000000001', 'product', '00000000-0000-4000-8000-000000000211', 'en', 'description', 'Grilled chicken, lettuce and tomato, served with fries.'),
  ('00000000-0000-4000-8000-000000000001', 'product', '00000000-0000-4000-8000-000000000212', 'tr', 'description', 'Marul, parmesan, kruton ve ev yapımı sezar sos.'),
  ('00000000-0000-4000-8000-000000000001', 'product', '00000000-0000-4000-8000-000000000212', 'en', 'description', 'Romaine, parmesan, croutons and house Caesar dressing.'),
  ('00000000-0000-4000-8000-000000000001', 'product', '00000000-0000-4000-8000-000000000213', 'tr', 'description', 'Mevsim yeşillikleri, beyaz peynir, zeytin ve zeytinyağı sos.'),
  ('00000000-0000-4000-8000-000000000001', 'product', '00000000-0000-4000-8000-000000000213', 'en', 'description', 'Seasonal greens, white cheese, olives and olive-oil dressing.'),
  ('00000000-0000-4000-8000-000000000001', 'product', '00000000-0000-4000-8000-000000000214', 'tr', 'description', 'Kurutulmuş ıhlamur çiçeğinden demlenir; kafeinsiz.'),
  ('00000000-0000-4000-8000-000000000001', 'product', '00000000-0000-4000-8000-000000000214', 'en', 'description', 'Brewed from dried linden blossom; caffeine free.'),
  ('00000000-0000-4000-8000-000000000001', 'product', '00000000-0000-4000-8000-000000000215', 'tr', 'description', 'Taze nane yaprağı ve dilim limon; kafeinsiz.'),
  ('00000000-0000-4000-8000-000000000001', 'product', '00000000-0000-4000-8000-000000000215', 'en', 'description', 'Fresh mint leaves with lemon slices; caffeine free.'),
  ('00000000-0000-4000-8000-000000000001', 'product', '00000000-0000-4000-8000-000000000216', 'tr', 'description', 'Uzak Doğu yeşil çayı, hafif ve ferahlatıcı.'),
  ('00000000-0000-4000-8000-000000000001', 'product', '00000000-0000-4000-8000-000000000216', 'en', 'description', 'Light and refreshing Far Eastern green tea.'),
  ('00000000-0000-4000-8000-000000000001', 'product', '00000000-0000-4000-8000-000000000217', 'tr', 'description', 'Üstü karamelize, içi akışkan Bask usulü cheesecake.'),
  ('00000000-0000-4000-8000-000000000001', 'product', '00000000-0000-4000-8000-000000000217', 'en', 'description', 'Basque-style tart, caramelised on top and soft in the middle.'),
  ('00000000-0000-4000-8000-000000000001', 'product', '00000000-0000-4000-8000-000000000218', 'tr', 'description', 'Bitter çikolatalı ıslak brownie, cevizli.'),
  ('00000000-0000-4000-8000-000000000001', 'product', '00000000-0000-4000-8000-000000000218', 'en', 'description', 'Fudgy dark-chocolate brownie with walnuts.'),
  ('00000000-0000-4000-8000-000000000002', 'product', '00000000-0000-4000-8000-000000000204', 'tr', 'description', '180 gr dana köfte, cheddar ve ev yapımı burger sosu.'),
  ('00000000-0000-4000-8000-000000000002', 'product', '00000000-0000-4000-8000-000000000204', 'en', 'description', '180 g beef patty with cheddar and house burger sauce.'),
  ('00000000-0000-4000-8000-000000000002', 'product', '00000000-0000-4000-8000-000000000219', 'tr', 'description', 'Odun ateşinde pişmiş kuzu şiş, pilav ve közlenmiş sebze ile.'),
  ('00000000-0000-4000-8000-000000000002', 'product', '00000000-0000-4000-8000-000000000219', 'en', 'description', 'Wood-fired lamb skewer with rice and grilled vegetables.'),
  ('00000000-0000-4000-8000-000000000002', 'product', '00000000-0000-4000-8000-000000000220', 'tr', 'description', 'Marine edilmiş tavuk göğsü, ızgara sebze eşliğinde.'),
  ('00000000-0000-4000-8000-000000000002', 'product', '00000000-0000-4000-8000-000000000220', 'en', 'description', 'Marinated chicken breast served with grilled vegetables.'),
  ('00000000-0000-4000-8000-000000000002', 'product', '00000000-0000-4000-8000-000000000221', 'tr', 'description', 'Tel kadayıf arasında peynir, kaymak ve şerbet ile.'),
  ('00000000-0000-4000-8000-000000000002', 'product', '00000000-0000-4000-8000-000000000221', 'en', 'description', 'Shredded pastry with cheese, clotted cream and syrup.'),
  ('00000000-0000-4000-8000-000000000002', 'product', '00000000-0000-4000-8000-000000000222', 'tr', 'description', 'Fırında pişmiş geleneksel sütlaç, tarçın ile.'),
  ('00000000-0000-4000-8000-000000000002', 'product', '00000000-0000-4000-8000-000000000222', 'en', 'description', 'Traditional oven-baked rice pudding with cinnamon.'),
  ('00000000-0000-4000-8000-000000000003', 'product', '00000000-0000-4000-8000-000000000205', 'tr', 'description', 'Günlük demlenen filtre kahve.')
on conflict (entity_type, entity_id, locale, field) do nothing;

-- ── Kapanmış gün geçmişi (Faz 23) ──────────────────────────────────────
-- Pano'nun ciro trendi `daily_sales_summary`den okunur ve oraya YALNIZCA
-- kapatılmış günler girer (0044). Seed'de hiç kapanış olmadığı için acme'nin
-- panosunda trend çizgisi hiç çizilmiyordu — ölçüldü: tablodaki 6 satırın
-- altısı da E2E'nin `test-s9-day-close-*` tenant'larına aitti.
--
-- Burada 14 günlük GEÇMİŞ kapanış üretiliyor. Kritik kısıt: **bugün asla
-- kapatılmaz**. `is_business_date_closed` bugüne bakar; bugünü kapatmak hem
-- raporlardaki "Günü Kapat" butonunu gizlerdi hem de o güne yeni ödeme
-- kabul edilmemesine yol açardı.
--
-- Tarihler `current_date`e göreli üretilir, böylece `db reset` her
-- koşuşunda geçmiş "son iki hafta" olarak taze kalır. Değerler haftalık
-- ritmi taşır (hafta sonu yüksek) ve D90 kural 2 gereği hiçbiri diğerinin
-- tekrarı değildir.
insert into public.day_closures
  (tenant_id, branch_id, business_date, revenue_minor, cash_minor, card_manual_minor,
   online_minor, tips_minor, comps_minor, refunds_minor, cancelled_orders_count)
select
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000011',
  current_date - d.offset_days,
  d.revenue, d.cash, d.card, d.online, d.tips, d.comps, d.refunds, d.cancelled
from (values
  (14, 412500, 151000, 198500,  63000,  9400,  4500,      0, 0),
  (13, 388000, 139500, 187000,  61500,  8700,      0,  6000, 1),
  (12, 502750, 178000, 241250,  83500, 12300,  7500,      0, 0),
  (11, 617400, 204500, 302900, 110000, 15600,  5000,  8500, 1),
  (10, 594800, 197000, 291300, 106500, 14900,      0,      0, 0),
  ( 9, 356200, 128500, 171700,  56000,  7800,  9000,      0, 2),
  ( 8, 331900, 119000, 160400,  52500,  7100,      0,  4500, 0),
  ( 7, 428600, 156500, 205600,  66500,  9900,  3000,      0, 0),
  ( 6, 401300, 145000, 193800,  62500,  9100,      0,      0, 1),
  ( 5, 533400, 186500, 258400,  88500, 13100,  6000,  5500, 0),
  ( 4, 655100, 218000, 320600, 116500, 16800,      0,      0, 0),
  ( 3, 628900, 209500, 308900, 110500, 15900,  4500,  7000, 1),
  ( 2, 372600, 134000, 179100,  59500,  8300,      0,      0, 0),
  ( 1, 345800, 124500, 166800,  54500,  7600,  7500,  3500, 1)
) as d(offset_days, revenue, cash, card, online, tips, comps, refunds, cancelled)
on conflict (tenant_id, branch_id, business_date) do nothing;

-- 0044'ün backfill'i ile aynı yol: özet tablo kapanışlardan doldurulur.
-- `order_count` burada orders'tan sayılamaz (bu günlerde gerçek sipariş
-- satırı yok, yalnızca kapanış özeti var) — ortalama sepet ~85 TL kabul
-- edilip cirodan türetiliyor, uydurma bir sabit yazılmıyor.
insert into public.daily_sales_summary
  (tenant_id, branch_id, business_date, revenue_minor, cash_minor, card_manual_minor,
   online_minor, tips_minor, comps_minor, refunds_minor, order_count)
select
  dc.tenant_id, dc.branch_id, dc.business_date, dc.revenue_minor, dc.cash_minor,
  dc.card_manual_minor, dc.online_minor, dc.tips_minor, dc.comps_minor, dc.refunds_minor,
  greatest(1, round(dc.revenue_minor / 8500.0)::int)
from public.day_closures dc
where dc.tenant_id = '00000000-0000-4000-8000-000000000001'
  and dc.business_date < current_date
on conflict (tenant_id, branch_id, business_date) do nothing;

-- ── Ürün görselleri ────────────────────────────────────────────────────
-- Görseller SQL ile yüklenemez (Storage'a dosya koymak gerekir). 21 demo
-- ürünün fotoğrafı `supabase/seed/images/` altında repo'da duruyor; hepsi
-- CC0 / Public Domain (kaynak ve lisans dökümü: images/CREDITS.md).
--
--   `supabase db reset` SONRASI:  node scripts/seed-images.mjs
--
-- Script dosyaları `menu-images` bucket'ına yükleyip products.image_url'ü
-- doldurur. Çalıştırılmazsa menü fotoğrafsız (metin öncelikli) görünür —
-- kırılmaz, yalnızca daha sade olur.
