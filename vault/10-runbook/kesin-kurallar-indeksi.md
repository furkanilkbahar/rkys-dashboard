---
tags: [runbook, kurallar, yasaklar, indeks]
ozet: "RULES.md'nin 46 kesin kuralinin kategorize indeksi — tam metin RULES.md'de kalir."
guncelleme: 2026-08-01
---

# Kesin Kurallar Indeksi

> RULES.md kok dizinde AYNEN kalir (bu proje icin "tek dogru kaynak" — yeni kural eklenmesi/degismesi hep oraya yazilir). Bu not sadece hizli kategori bazli gezinme icindir, tam madde metni icin RULES.md'yi ac.

## Guvenlik & Multi-Tenancy (madde 1-8, EN KRITIK)
RLS'siz tablo yasak · tenant_id filtresiz sorgu yasak · service_role client'a sizmaz · secret'lar asla commit edilmez · musteri yazmalari imzali token'li RPC/Edge Fn uzerinden · webhook imza dogrulamasi zorunlu · QR/token'lar tahmin edilemez · rate limiting atlanamaz.

## Kod Kalitesi (9-14)
`any`/`@ts-ignore` yasak · dogrulanmamis girdi (Zod'suz) islenmez · hardcoded UI metni yasak · para float degil integer kurus · tenant'a ozel `if` yasak · olu kod birakilmaz.

## Veritabani (15-18)
Dashboard'dan elle sema degisikligi yasak · geriye donuk veri kaybi onceden onay · uretim verisi silen script onaysiz calismaz · siparis gecmisi hicbir islemde silinmez.

## Surec (19-22)
Faz atlamak/kapsam disi ozellik yasak · mimari karar once ilgili `vault/20-mimari` notu guncellenir + onay · buyuk bagimlilik onaya sunulur · testler yesile donmeden commit yok.

## Urun Davranisi (23-26)
Stogu biten urun sepete eklenemez (server-side de) · durum makinesi atlanamaz · tenant izolasyonu mutlak · private tema atanmadigi tenant'ta gorunmez.

## v2.0 Ek (27-32)
Masa tasima yalniz personel RPC'si · plan limiti DB'de de zorunlu · PIN hash'li · dusuk puan Google'a yonlenmez · idempotency zorunlu · genel QR'da masa secimsiz siparis olmaz.

## v3.0 Ek (33-46)
branch_id'siz operasyonel tablo yasak · kapali modul server'da da engellenir · ikram/iade sebep kodu zorunlu · kasa vardiyasi kapanmadan yenisi acilamaz · hediye karti bakiyesi negatife dusmez · OTP/SMS rate limit + maskeli telefon · recete dusumu server-side · webhook HMAC zorunlu · izin bayragi kontrolu atlanamaz · **acik karar kapatilmadan gelistirme baslamaz** · E2E senaryolari silinemez (bkz. [[e2e-senaryolari]]) · **production'a erken cikis yasak** (bkz. [[ortamlar-ve-deploy]]) · Adim sonu commit+push onaysiz (D75, bkz. [[faz-kapanis-ve-onay-akisi]]).

## Baglantili notlar
[[faz-kapanis-ve-onay-akisi]] · [[sube-multi-tenancy]]
