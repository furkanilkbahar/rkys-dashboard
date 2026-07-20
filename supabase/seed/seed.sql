-- Demo seed: 2 tenant, her biri 1 şube, tam modül seti, temel izin bayrakları.
-- Idempotent: `supabase db reset` her koşumda tabloları sıfırdan kurduğu için
-- on conflict koruması sadece manuel tekrar-koşum için güvenlik.

insert into public.tenants (id, slug, name, status, timezone, currency)
values
  ('00000000-0000-4000-8000-000000000001', 'acme', 'Acme Kafe', 'active', 'Europe/Istanbul', 'TRY'),
  ('00000000-0000-4000-8000-000000000002', 'beta', 'Beta Restoran', 'active', 'Europe/Istanbul', 'TRY')
on conflict (id) do nothing;

insert into public.tenant_domains (tenant_id, domain, is_primary)
values
  ('00000000-0000-4000-8000-000000000001', 'acme.localhost:3000', true),
  ('00000000-0000-4000-8000-000000000002', 'beta.localhost:3000', true)
on conflict (domain) do nothing;

insert into public.branches (id, tenant_id, name, is_default)
values
  ('00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000001', 'Merkez Şube', true),
  ('00000000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000002', 'Merkez Şube', true)
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
    ('staff_scheduling'), ('accounting_export'), ('api_access')
) as m(module_key)
on conflict (tenant_id, module_key) do nothing;

insert into public.role_permissions (tenant_id, role, permission_key, allowed)
select t.id, r.role, p.permission_key, true
from public.tenants t
cross join (values ('owner'), ('manager')) as r(role)
cross join (
  values
    ('comp_discount'), ('refund'), ('reports.revenue'), ('reports.profit'),
    ('menu.edit'), ('cash.open_close'), ('session.move'), ('reservations.manage')
) as p(permission_key)
on conflict (tenant_id, role, permission_key) do nothing;

-- Demo menü kataloğu (Faz 1): acme'de varyant+ekstra+tükenmiş ürün örnekleri,
-- beta'da minimal bir tenant-izolasyon karşılaştırma seti.
insert into public.tenant_locales (tenant_id, locale, is_default)
values
  ('00000000-0000-4000-8000-000000000001', 'tr', true),
  ('00000000-0000-4000-8000-000000000001', 'en', false),
  ('00000000-0000-4000-8000-000000000002', 'tr', true),
  ('00000000-0000-4000-8000-000000000002', 'en', false)
on conflict (tenant_id, locale) do nothing;

insert into public.menu_categories (id, tenant_id, layout, display_order)
values
  ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000001', 'grid', 0),
  ('00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000001', 'list', 1),
  ('00000000-0000-4000-8000-000000000103', '00000000-0000-4000-8000-000000000002', 'grid', 0)
on conflict (id) do nothing;

insert into public.products (id, tenant_id, category_id, track_mode, base_price_minor, stock_quantity, is_sold_out, display_order)
values
  ('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', 'simple', 8000, null, false, 0),
  ('00000000-0000-4000-8000-000000000202', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', 'simple', 9000, null, false, 1),
  ('00000000-0000-4000-8000-000000000203', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000102', 'simple', 12000, 0, true, 0),
  ('00000000-0000-4000-8000-000000000204', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000103', 'simple', 15000, null, false, 0)
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
  ('00000000-0000-4000-8000-000000000001', 'product_extra', '00000000-0000-4000-8000-000000000402', 'en', 'name', 'Chocolate Sauce')
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
  ('00000000-0000-4000-8000-000000000706', '00000000-0000-4000-8000-000000000002', 'assistance', true, 2)
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
  ('00000000-0000-4000-8000-000000000002', 'call_type', '00000000-0000-4000-8000-000000000706', 'en', 'name', 'I need help')
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
  ('00000000-0000-4000-8000-000000000504', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000012', 'Masa 1', encode(digest('demo-beta-table-1', 'sha256'), 'hex'))
on conflict (id) do nothing;

insert into public.generic_qr_codes (id, tenant_id, branch_id, label, qr_token_hash)
values
  ('00000000-0000-4000-8000-000000000601', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011', 'Genel QR', encode(digest('demo-acme-generic', 'sha256'), 'hex')),
  ('00000000-0000-4000-8000-000000000602', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000012', 'Genel QR', encode(digest('demo-beta-generic', 'sha256'), 'hex'))
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
  )
on conflict (provider_id, provider) do nothing;

insert into public.profiles (id, tenant_id, role, is_active)
values
  ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000001', 'owner', true),
  ('00000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-000000000001', 'manager', true),
  ('00000000-0000-4000-8000-0000000000a3', '00000000-0000-4000-8000-000000000001', 'waiter', true),
  ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-000000000002', 'owner', true)
on conflict (id) do nothing;