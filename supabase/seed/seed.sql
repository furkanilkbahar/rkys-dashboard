-- Demo seed: 2 tenant, her biri 1 şube, tam modül seti, temel izin bayrakları.
-- Idempotent: `supabase db reset` her koşumda tabloları sıfırdan kurduğu için
-- on conflict koruması sadece manuel tekrar-koşum için güvenlik.

insert into public.tenants (id, slug, name, status, timezone, currency)
values
  ('00000000-0000-0000-0000-000000000001', 'acme', 'Acme Kafe', 'active', 'Europe/Istanbul', 'TRY'),
  ('00000000-0000-0000-0000-000000000002', 'beta', 'Beta Restoran', 'active', 'Europe/Istanbul', 'TRY')
on conflict (id) do nothing;

insert into public.tenant_domains (tenant_id, domain, is_primary)
values
  ('00000000-0000-0000-0000-000000000001', 'acme.localhost:3000', true),
  ('00000000-0000-0000-0000-000000000002', 'beta.localhost:3000', true)
on conflict (domain) do nothing;

insert into public.branches (id, tenant_id, name, is_default)
values
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', 'Merkez Şube', true),
  ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000002', 'Merkez Şube', true)
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
    '00000000-0000-0000-0000-0000000000a1',
    'authenticated', 'authenticated', 'owner@acme.test',
    crypt('password123', gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}', '{}',
    now(), now(),
    '', '', '', '', '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-0000000000b1',
    'authenticated', 'authenticated', 'owner@beta.test',
    crypt('password123', gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}', '{}',
    now(), now(),
    '', '', '', '', '', '', '', ''
  )
on conflict (id) do nothing;

insert into auth.identities (id, provider_id, user_id, identity_data, provider, created_at, updated_at)
values
  (
    gen_random_uuid(), '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a1',
    '{"sub":"00000000-0000-0000-0000-0000000000a1","email":"owner@acme.test"}', 'email', now(), now()
  ),
  (
    gen_random_uuid(), '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b1',
    '{"sub":"00000000-0000-0000-0000-0000000000b1","email":"owner@beta.test"}', 'email', now(), now()
  )
on conflict (provider_id, provider) do nothing;

insert into public.profiles (id, tenant_id, role, is_active)
values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000001', 'owner', true),
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000002', 'owner', true)
on conflict (id) do nothing;