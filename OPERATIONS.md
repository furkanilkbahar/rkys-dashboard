# OPERATIONS.md — Operasyonel Olgunluk Standartları

> v1.0 — Ürün kadar, ürünün ayakta durma biçimi de profesyonel olmalı.

## 1. Ortamlar ve Dağıtım
- **Lokal öncelikli geliştirme (D67):** Docker + Supabase CLI ile tüm sistem geliştirici makinesinde çalışır ve test edilir; Docker image üretimi proje içinde hazırlanır (self-hosted paketin temeli). Akış: **Lokal → GitHub (CI) → Staging → Production**.
- **Production + Staging** (ayrı Supabase projeleri; staging'de test tenant'ları) + **PR başına preview** (Vercel). Production hedefi: **Vercel + Supabase Cloud** (canlıya alma, proje olgunlaşınca).
- Migration'lar önce staging'de koşar; prod'a CI onaylı pipeline ile gider. Elle prod değişikliği yasak (RULES 15).
- **CI zorunlu:** `tsc --noEmit`, lint, testler ve RLS izolasyon testleri geçmeden merge edilemez.

## 2. İzleme ve Hata Takibi
- **Sentry:** client + server hata takibi, release etiketli.
- **Uptime izleme:** ana yüzeyler (menü, paneller, API) + Supabase sağlık uçları; eşik aşımında bildirim.
- Yapılandırılmış loglama; kritik akışlarda (ödeme, iade, lisans) korelasyon ID.
- Anomali/iş metrikleri Analitik Merkezi'nde (ürün içi); sistem metrikleri burada (altyapı).

## 3. Status Sayfası ve Kesinti İletişimi
- Public **status sayfası** (`status.domain.com`): bileşen bazlı durum + olay geçmişi.
- **Planlı bakım:** Süper Admin'den duyuru → status sayfası + tüm panellerde **banner** ("X tarihinde 5 dk bakım").
- Olay (incident) akışı: tespit → status güncelle → çözüm → kısa post-mortem notu (`audit`).

## 4. Yedekleme ve Felaket Kurtarma
- Günlük otomatik DB yedeği + **PITR (point-in-time recovery)** aktif.
- Storage (görseller) yedeği; yedekler farklı konumda saklanır.
- **Ayda bir geri dönüş tatbikatı:** staging'e restore edilip doğrulanır (yedek, restore edilene kadar yedek değildir).
- RPO ≤ 24 saat (hedef PITR ile dakikalar), RTO hedefi ≤ 4 saat (v1).

## 5. Güvenlik Duruşu
- **2FA (TOTP):** altyapı hazır; zorunluluk `platform_settings.enforce_2fa` ile **Süper Admin kontrolünde** (varsayılan: opsiyonel). Owner/Manager kendi hesabında açabilir. Öneri: canlıya çıkışta süper admin hesabında aktif edilmesi.
- Secrets yalnız env/secret manager; rotasyon prosedürü yazılı.
- Rate limiting (sipariş/çağrı/OTP/login), webhook HMAC imzaları, oturum güvenliği (kısa ömürlü imzalı token'lar).
- Bağımlılık taraması (npm audit/Dependabot); yayına çıkmadan temel sızma testi kontrol listesi.
- KVKK: aydınlatma/çerez onayları, veri silme talebi akışı, `audit_logs` üzerinde kritik işlem izi.

## 6. Veri ve Performans Hijyeni
- Rapor sorguları özet tablolar/materialized view (`daily_sales_summary`) üzerinden; ham tablolar sınırsız saklanır.
- Görseller CDN + WebP; menü LCP < 2.5 sn bütçesi her sürümde ölçülür.
- Zamanlanmış işler (timeout kapama, özet üretimi, rapor gönderimi, webhook retry) Edge cron'da; başarısızlıkları izlenir.

## 7. Sürüm ve Değişiklik Yönetimi
- Conventional Commits + anlamlı sürüm etiketleri; her yayında kısa changelog (Süper Admin duyurusuna bağlanabilir).
- Feature flag olarak **Modül Sistemi** kullanılır; yarım özellik prod'a kapalı modül olarak çıkabilir.
- Geri alma planı: her migration için down/rollback notu.
