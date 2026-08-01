---
tags: [runbook, izleme, guvenlik, status-sayfasi]
ozet: "Sentry+uptime izleme, status sayfasi/bakim iletisimi, guvenlik durusu standartlari."
guncelleme: 2026-08-01
---

# Izleme & Guvenlik Durusu

## Izleme ve Hata Takibi
- **Sentry:** client + server hata takibi, release etiketli.
- **Uptime izleme:** ana yuzeyler (menu, paneller, API) + Supabase saglik uclari; esik asiminda bildirim.
- Yapilandirilmis loglama; kritik akislarda (odeme, iade, lisans) korelasyon ID.
- Anomali/is metrikleri Analitik Merkezi'nde ([[analitik-merkezi]]); sistem metrikleri burada (altyapi).

## Status Sayfasi ve Kesinti Iletisimi
- Public **status sayfasi** (`status.domain.com`): bilesen bazli durum + olay gecmisi.
- **Planli bakim:** Super Admin'den duyuru -> status sayfasi + tum panellerde banner.
- Olay akisi: tespit -> status guncelle -> cozum -> kisa post-mortem notu (`audit`).

## Guvenlik Durusu
- **2FA (TOTP):** altyapi hazir; zorunluluk `platform_settings.enforce_2fa` ile Super Admin kontrolunde (varsayilan opsiyonel). Canliya cikista super admin hesabinda aktif edilmesi onerilir.
- Secrets yalniz env/secret manager; rotasyon prosedürü yazili.
- Rate limiting (siparis/cagri/OTP/login), webhook HMAC imzalari, kisa omurlu imzali oturum token'lari.
- Bagimlilik taramasi (npm audit/Dependabot); yayina cikmadan temel sizma testi kontrol listesi.
- KVKK: aydinlatma/cerez onaylari, veri silme talebi akisi, `audit_logs` uzerinde kritik islem izi.

## Ilgili kararlar
D58 (2FA), D59 (status sayfasi), D34 (KVKK). Kesin kurallar: RULES.md §Guvenlik & Multi-Tenancy.

## Baglantili notlar
[[ortamlar-ve-deploy]] · [[sube-multi-tenancy]]
