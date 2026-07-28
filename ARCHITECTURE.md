# ARCHITECTURE.md — Teknik Mimari

> v3.0 — Stack: Next.js (App Router) + Supabase · Çok kiracılı + çok şubeli + modüler

---

## 1. Genel Mimari

```
┌────────────────────────────────────────────────────────────┐
│                     Next.js (tek uygulama)                 │
│  (marketing)/ (menu)/ (admin)/ (waiter)/ (kitchen)/        │
│  (cashier)/ (analytics)/ (platform)/  ·  api/ (tenant API) │
└──────────────────────────┬─────────────────────────────────┘
                           │
              ┌────────────▼────────────┐
              │        Supabase         │
              │ Postgres(RLS)·Auth      │
              │ Realtime·Storage·EdgeFn │
              └────────────┬────────────┘
        iyzico ── lib/payments           lib/integrations ── pazar yeri /
        (ödeme+abonelik+iade)            muhasebe / ÖKC / yazıcı adaptörleri
```

- **Tenant çözümleme:** middleware subdomain → `tenant_id`; `tenant_domains` ile custom domain kapısı.
- **Şube çözümleme:** oturumdaki aktif `branch_id`; tek şubeli tenant'ta otomatik ve görünmez.
- **Realtime:** `orders`, `order_items`, `waiter_calls`, `table_sessions`, `reservations` tenant+branch kanallı.

## 2. Çekirdek Mimari Desenler

1. **Modül Sistemi (Dinamik Ölçeklenme):** `tenant_modules` feature-flag tablosu. Modül anahtarları: `pos_cash`, `inventory`, `recipes`, `crm_loyalty`, `campaigns`, `gift_cards`, `pickup`, `delivery`, `courier`, `marketplace`, `reservations`, `kiosk`, `staff_scheduling`, `accounting_export`, `api_access`... Kapalı modül: menüde görünmez, route'u 404/redirect, API'si 403. Kontrol tek noktadan: `lib/modules/isEnabled(tenantId, moduleKey)` + navigasyon/route guard bunu kullanır.
2. **Şube katmanı:** operasyonel her tabloda `branch_id` (tenant_id ile birlikte). v1: tenant oluşunca otomatik 1 branch. Şube seçici bileşeni hazır, tek şubede gizli.
3. **İzin bayrakları:** `role_permissions` (tenant × rol × permission_key → bool). Anahtar örnekleri: `comp_discount`, `refund`, `reports.revenue`, `reports.profit`, `menu.edit`, `cash.open_close`, `session.move`, `reservations.manage`. Kontrol: `lib/auth/can(user, permissionKey)`.
4. **Adaptör mimarisi:** `lib/integrations/{delivery|accounting|fiscal|printer}` ortak arayüzler; sağlayıcılar (yemeksepeti, getir, aracı-katman, parasut, escpos...) adaptör olarak eklenir. AÇIK KARAR D51: pazar yerine doğrudan mı aracı katmanla mı bağlanılacağı onay süreçleri netleşince.
5. **Kanal tek motoru:** tüm siparişler `orders.channel` (`dine_in|pickup|delivery|marketplace`) ile tek durum makinesi ve tek KDS'ten akar.

## 3. Multi-Tenancy ve Güvenlik (özet — detay RULES/OPERATIONS)
- Her tabloda `tenant_id` (+operasyonelde `branch_id`), RLS zorunlu; personel JWT claim (tenant_id, user_role — "role" PostgREST'in rezerve claim'i olduğu için kullanılmaz), müşteri anon yazmaları imzalı masa/OTP token'lı RPC/Edge Fn; Süper Admin ayrı claim. `service_role` yalnız server. Plan limitleri (masa, şube) UI + DB (trigger/RPC) çift katman. 2FA: TOTP altyapısı; zorunluluk `platform_settings.enforce_2fa` (Süper Admin kontrolü, varsayılan kapalı).

## 4. Veri Modeli (tablo grupları)

**Platform:** `tenants`, `tenant_domains`, `plans` (masa limiti, dahil şube sayısı, ek şube ücreti), `subscriptions` (14g kartsız trial), `licenses` (lifetime/self-hosted), `themes` + `tenant_themes`, `platform_payments`, `platform_settings` (enforce_2fa...), `media_library`, `announcements` (bakım duyuruları → panel banner).

**Şube & Kimlik:** `branches`; `profiles` (rol: owner|manager|waiter|kitchen|courier; badge_no, photo_url, pin_hash), `staff_branch_assignments`, `staff_devices`, `role_permissions`, `tenant_modules`.

**Masa & Oturum:** `tables` (branch_id), `generic_qr_codes`, `table_sessions` (+`session_events`: taşıma vb.).

**Menü:** `menu_categories` (layout, station), `products` (track_mode: `simple|recipe`), `product_variants`, `product_extras`, `branch_product_overrides` (fiyat farkı, şube stok, is_available), `translations`, `tenant_locales`.

**Stok & Maliyet:** `ingredients` (birim, kritik seviye), `recipes` + `recipe_items` (ürün/varyant → malzeme gramaj), `stock_movements` (giriş/satış düşümü/fire/sayım; hareketli ortalama maliyet), `suppliers`, `purchases` (basit alım; PO genişlemesi ileride), `product_costs` (manuel maliyet — reçete yoksa).

**Sipariş & Ödeme:** `orders` (channel, branch_id, device_id, idempotency_key, durum makinesi + `cancel_requested`), `order_items` (+fiyat/maliyet kopyası), `order_item_extras`, `payments` (method, tip_amount, split_group), `refunds` (tam/kısmi, sebep kodu, provider_ref), `comps` (ikram/indirim/void; sebep kodu, yetkili), `reason_codes` (tenant düzenlenebilir), `tip_presets`, `pricing_rules`.

**Kasa:** `cash_shifts` (branch, açılış bakiye, kapanış sayım, beklenen, fark, açan/kapatan), `cash_movements` (kasaya giren/çıkan), `day_closures` (gün sonu raporu snapshot'ı — muhasebe exportlarının kaynağı).

**Kanallar & Kurye:** `delivery_zones` (bölge, ücret, min sepet), `customer_addresses`, `scheduled_orders`, `courier_assignments`, `product_external_mappings` (pazar yeri SKU↔ürün eşlemesi).

> Mimari revizyon (Faz 10 Adım 2): planlanan ayrı `marketplace_accounts` tablosu kurulmadı — aracı platformun kimliği tenant'ın kendi `api_keys` anahtarıyla çözülür (tenant anahtarını platforma verir), `authenticateApiRequest` (lib/api/auth.ts) tüm Tenant API + inbound webhook uçlarının tek kimlik doğrulama noktası olarak genişletildi. Gerekçe: ayrı bir "entegrasyon hesabı" kavramı icat etmek yerine zaten var olan tek mekanizmanın yeniden kullanılması (RULES/CLAUDE.md'nin gereksiz soyutlamadan kaçınma ilkesiyle tutarlı).

**CRM & Pazarlama:** `customers` (telefon, OTP doğrulama, KVKK onayları), `otp_codes`, `loyalty_programs` (mode: `stamp|points` + kurallar), `loyalty_balances`, `loyalty_transactions`, `campaigns`, `coupons` + `coupon_redemptions`, `customer_segments` (şema; kullanım CRM sonrası), `gift_cards` + `gift_card_transactions` (bakiye=borç muhasebesi).

**Modüller:** `reservations` (+ `waitlist`), `kiosk_devices`, `staff_shifts` (planlama), `timeclock_entries` (PIN giriş-çıkış).

**Analitik & Sistem:** `report_schedules` (zamanlanmış e-posta/PDF), `goals` (ciro hedefleri), `anomaly_alerts`, `api_keys`, `webhooks` + `webhook_deliveries` (imzalı, retry'lı), `accounting_sync_log` (muhasebe senkronizasyon denemeleri), `audit_logs`, `support_tickets` + `ticket_messages` (tenant→Süper Admin destek), `ratings` + `rating_settings`, `waiter_calls` + `call_types`, `notification_settings`.

> İlkeler: para = integer kuruş; fiyat **ve maliyet** siparişe kopyalanır; UTC + tenant timezone/currency; sipariş/ödeme geçmişi silinmez; **veri geçmişi sınırsız** (rapor sorguları için özet tablolar/materialized view'lar: `daily_sales_summary` vb.).

## 5. Kritik Akışlar (v3 ekleri)

- **Kasa vardiyası:** `open_shift(opening_balance)` → satış/ödemeler shift'e bağlanır → `close_shift(counted_cash)` → beklenen−sayılan farkı → gün sonu `day_closures` snapshot → export.
- **İkram/iade:** izin bayrağı kontrolü → sebep kodu zorunlu → `comps`/`refunds` kaydı → online iade iyzico API → raporlara (kayıp-kaçak) akar.
- **Reçete düşümü:** `track_mode=recipe` ürün satıldığında Edge Fn `recipe_items` üzerinden `stock_movements` (satış düşümü) yazar; kritik seviye altında uyarı.
- **OTP sadakat:** menüden "katıl" → SMS OTP → `customers` doğrulanır → oturum harcamaları müşteriye bağlanır → damga/puan `loyalty_transactions`.
- **Webhook:** olay → `webhook_deliveries` kuyruğu → HMAC imzalı POST → başarısızsa üstel geri çekilmeli retry.
- **Pazar yeri ingestion:** aracı platform → `POST /api/integrations/marketplace/[provider]/orders` (tenant API anahtarıyla kimlikli) → SKU eşlemesi → `ingest_marketplace_order` → doğrudan `approved` durumuyla KDS'e (kanal tek motoru).
- **Muhasebe senkronizasyonu:** admin bir `served` siparişi manuel tetikler → `AccountingProvider.syncOrderInvoice` (D61, şu an yalnızca mock) → `accounting_sync_log`'a başarı/hata satırı.
- **ÖKC (fiskal cihaz) adaptör kapısı (D61 → D84 ile güncellendi, Faz 17):** `lib/integrations/fiscal/{provider,mock,index}.ts` artık `PaymentProvider` (`lib/payments`) ile birebir aynı mock-first desende — gerçek bir ÖKC sağlayıcısı hâlâ yok (GİB sertifikasyonu bu kapsamda alınamıyor) ama `mockFiscalProvider` var ve `record_payment` akışına (kasa ödeme, `cashier/pay/actions.ts`) gerçekten bağlı: her tamamlanmış ödemede (fiscal_integration modülü açıksa) mock fiş kesilir, `fiscal_receipts` tablosuna denetim izi yazılır. `get_fiscal_daily_summary` RPC'si günlük fiş sayısı/toplamını döner. Somut bir ÖKC modeli seçildiğinde `iyzico.ts` ile aynı şekilde yeni bir adaptör eklenir.
- **Zamanlanmış rapor:** `report_schedules` → Edge cron → PDF/e-posta (Resend).
- **Anomali:** gecelik job `daily_sales_summary` kıyası → eşik aşımı → `anomaly_alerts` + panel/e-posta bildirimi.

## 6. Tema, i18n, Dayanıklılık, Self-Hosted
v2.0 ile aynı: CSS-variable tema paketleri (`warm-luxury` v1, public/private atama), next-intl + DB çevirileri, reconnect+senkron+idempotency+sepet koruması, Supabase self-host uyumu + tek docker-compose hedefi + `lib/licensing` izolasyonu. Ortamlar/CI/yedekleme: **OPERATIONS.md**.
