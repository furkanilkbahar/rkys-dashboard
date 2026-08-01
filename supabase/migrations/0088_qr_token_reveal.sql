-- D86 (bug-hunt 2026-08-01): "QR göster" — fiziksel QR'ı bozmadan tekrar
-- görüntüleme. Önceki tasarım yalnızca hash sakladığından her "göster"
-- isteği aslında yeni token üretip eskisini geçersiz kılmak zorundaydı
-- (regenerate = tek yol). Ham token'ın AES-256-GCM ile şifreli bir kopyası
-- eklenir (hash'in yerine değil, ek olarak) — yalnızca uygulama katmanında
-- (lib/qr/token.ts) QR_TOKEN_ENCRYPTION_KEY ile şifrelenip çözülür, Postgres
-- bu değeri hiç yorumlamaz (opak text). Anahtar yoksa kolon null kalır,
-- mevcut oluşturma/yenileme akışları etkilenmez.
alter table public.tables add column qr_token_encrypted text;
alter table public.generic_qr_codes add column qr_token_encrypted text;
