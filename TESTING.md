# TESTING.md — Test Stratejisi

> **Icerik vault'a tasindi (2026-08-01).** Bu dosya artik yalniz yonlendirme notudur.

## Nereye bakmali
`vault/00-index/INDEX.md` → **Runbook** bolumu:
- `test-stratejisi` — katmanlar/araclar, Faz Kapanis Kriteri (DoD), RLS sablonu, kapsam disi, bilinen test aciklari
- `e2e-senaryolari` — **YASAYAN liste** (S1-S55+); yeni kritik akis eklendiginde SENARYO buraya eklenir (RULES #44)
- `faz-kapanis-ve-onay-akisi` — otomatik dogrulama + onay surecinin GUNCEL hali (D73-D79)

## Yeni test / senaryo eklerken
Yeni E2E senaryosu `vault/10-runbook/e2e-senaryolari.md`'ye eklenir (silinmez/atlanmaz). Sureç/katman degisikligi `vault/10-runbook/test-stratejisi.md`'ye islenir.
