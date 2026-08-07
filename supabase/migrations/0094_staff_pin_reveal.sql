-- D102: "PIN Göster" — personelin PIN'ini fiziksel olarak sıfırlamadan tekrar
-- görüntüleme. D86'daki QR çözümünün birebir aynısı: doğrulama hâlâ
-- profiles.pin_hash (bcrypt) üzerinden yürür, buraya ham PIN'in AES-256-GCM
-- ile ŞİFRELİ bir kopyası yazılır (hash'in yerine değil, ek olarak). Şifreleme
-- yalnızca uygulama katmanındadır (lib/staff/pin.ts, STAFF_PIN_ENCRYPTION_KEY);
-- Postgres bu değeri hiç yorumlamaz, opak text'tir.
--
-- NEDEN profiles'a KOLON DEĞİL de ayrı tablo: profiles_tenant_select (0007)
-- bir tenant'ın TÜM personeline tüm satırları okutur — şifreli PIN orada
-- dursaydı garson, müdürün ciphertext'ini PostgREST'ten çekip saklayabilir,
-- anahtar bir gün sızdığında toplu çözebilirdi. Bu tablonun authenticated
-- için HİÇ policy'si yok (RLS açık + policy yok = kimse okuyamaz) ve grant'i
-- yalnız service_role'de; ciphertext sunucudan hiç çıkmaz.
create table public.staff_pin_secrets (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  pin_encrypted text not null,
  updated_at timestamptz not null default now()
);

create index idx_staff_pin_secrets_tenant_id on public.staff_pin_secrets(tenant_id);

alter table public.staff_pin_secrets enable row level security;

-- Bilerek policy yok: anon/authenticated bu tabloyu ne okuyabilir ne yazabilir.
-- service_role RLS'i bypass eder (RULES #3 — yalnız sunucu tarafı).
grant select, insert, update, delete on public.staff_pin_secrets to service_role;
