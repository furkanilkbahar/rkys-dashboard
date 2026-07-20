# CLAUDE.md — Proje Talimatları (Claude Code)

Bu proje çok kiracılı (multi-tenant), çok şubeli ve **modüler** bir **Kafe & Restoran Yönetim SaaS** platformudur.
Ürün anayasası: çekirdek = QR menü; diğer her yetenek tenant'ın açıp kapattığı bir modüldür (Dinamik Ölçeklenme İlkesi, bkz. DECISIONS D38).
Bağlam için sırasıyla oku: `PRD.md` → `ARCHITECTURE.md` → `PLAN.md` → `RULES.md` → `OPERATIONS.md` → `DECISIONS.md`.
Bir davranışın gerekçesini merak edersen `DECISIONS.md` karar günlüğüne bak; kararları onaysız değiştirme.

## Dil ve İletişim
- Kullanıcıyla iletişim **Türkçe**; teknik terimler ve komutlar İngilizce orijinal haliyle kalır.
- Kod, değişken/fonksiyon adları, commit mesajları ve kod içi yorumlar **İngilizce**.
- Kullanıcıya görünen tüm UI metinleri i18n üzerinden gelir; koda hardcoded metin yazılmaz.

## Çalışma Şekli
1. **Önce plan, sonra kod:** Orta/büyük her görevde önce kısa bir uygulama planı sun, onay al, sonra uygula.
2. `PLAN.md`'deki faz sırasına uy; mevcut fazın kapsamı dışına çıkma, faz atlama.
3. Tamamlanan maddeleri `PLAN.md`'de işaretle; mimari bir karar değişirse önce `ARCHITECTURE.md`'yi güncelle.
4. **Otonom karar eşiği:** Belirsizlikte önce şunu değerlendir — karar `RULES.md`'deki kesin bir kuralı, mimariyi (`ARCHITECTURE.md`), faz/kapsam sınırını, geri dönüşü zor bir işlemi (migration, veri kaybı, production/staging deploy, dış sisteme yazma) ya da ürünün gerçek davranışını/kullanıcı tercihini etkiliyor mu?
   - **Evet** → dur, kullanıcıya sor.
   - **Hayır** (isimlendirme, küçük implementasyon detayı, dosya/klasör organizasyonu, yardımcı fonksiyon şekli gibi düşük riskli ve geri alınabilir seçimler) → kendi içinde hızlıca değerlendir; seçeneklerden biri makul ölçüde daha iyiyse (kabaca %80+ eminsen) onu seç ve devam et, yanıtında tek satır **"Varsayım: ..."** notuyla belirt. Sormak için durma.
   - Aradaysan (emin değilsen) en olası 1-2 seçeneği kısaca sun, onay isteyip devam et.
5. Büyük görevleri küçük, doğrulanabilir adımlara böl; her adım sonunda uygulama çalışır durumda olsun.

## Stack (özet — detay ARCHITECTURE.md)
- Next.js App Router + TypeScript **strict** + Tailwind + shadcn/ui + Framer Motion
- Supabase: Postgres (RLS), Auth, Realtime, Storage, Edge Functions
- TanStack Query, Zustand (sepet), React Hook Form + Zod, next-intl
- Ödeme: iyzico (abstraction layer arkasında)

## Kod Standartları
- Server Components varsayılan; `"use client"` yalnızca gerektiğinde.
- Tüm dış girdiler (form, API, webhook) **Zod** ile doğrulanır; şemalar client/server arasında paylaşılır.
- Veri erişimi dağınık sorgularla değil, `lib/data/` altındaki katman üzerinden yapılır.
- Supabase tipleri otomatik üretilir (`supabase gen types`), elle DB tipi yazılmaz.
- Hata yönetimi: kullanıcıya anlaşılır Türkçe mesaj (i18n), log'a teknik detay.
- Bileşenler tema token'larını (CSS variables) kullanır; tenant'a özel renk/stil hardcode edilmez. v1 teması: `warm-luxury`.
- Para değerleri integer kuruş (minor units) olarak saklanır ve hesaplanır.
- Tarihler UTC saklanır, tenant timezone'una göre gösterilir.

## Veritabanı Kuralları
- Şema değişikliği **yalnızca migration dosyasıyla** yapılır; dashboard'dan elle değişiklik yok.
- Yeni tenant tablosu = `tenant_id` kolonu + RLS politikaları + index, aynı migration içinde.
- Sipariş kalemlerine fiyat **kopyalanır**; geçmiş veriler asla yeniden hesaplanmaz.
- Seed script her şema değişikliğinde güncel tutulur.

## Dizin Yapısı (hedef)
```
src/
  app/
    (marketing)/  (menu)/  (admin)/  (waiter)/  (kitchen)/  (platform)/
    api/
  components/     # paylaşılan UI
  themes/         # tema paketleri (premium/, ...)
  lib/
    supabase/  data/  auth/  payments/  licensing/  qr/  utils/
  i18n/           # UI çevirileri (tr, en, ...)
supabase/
  migrations/  functions/  seed/
```

## Test & Doğrulama
- RLS izolasyon testleri: her yeni tablo için "tenant A, tenant B'nin verisini göremez/yazamaz" testi zorunlu.
- Kritik akışlara (sipariş oluşturma, durum makinesi, çağrı, lisans doğrulama) birim/entegrasyon testi.
- PR/commit öncesi: `tsc --noEmit`, lint ve testler geçmeli.
- Test stratejisi TESTING.md'dedir: her fazda ilgili E2E senaryoları yazılır, faz kapanış kriterleri uygulanır.
- **Faz sonu ritüeli:** kullanıcıya sohbette 5–10 maddelik manuel el testi listesi sun (dosya oluşturma); onay almadan sonraki faza geçme.

## Commit Kuralları
- Conventional Commits: `feat:`, `fix:`, `refactor:`, `db:`, `docs:`, `chore:`
- Küçük ve odaklı commit'ler; migration'lar ayrı commit.

## Yasaklar
Kesin yasaklar için `RULES.md` dosyasına uy — bu dosya her görevde geçerlidir.
