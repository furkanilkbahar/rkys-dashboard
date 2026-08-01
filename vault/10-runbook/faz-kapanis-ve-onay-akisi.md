---
tags: [runbook, onay-akisi, faz-kapanisi, commit]
ozet: "GUNCEL durum: adim ici onay yok, faz gecisinde onay yok; adim sonu otomatik commit+push."
guncelleme: 2026-08-01
---

# Faz Kapanisi & Onay Akisi (guncel hali)

> Bu surec D73'ten D79'a 7 kararla evrildi (bkz. [[onay-sureci-kararlari]] tarihsel gerekce icin). Burasi SADECE bugun gecerli olan nihai hali anlatir.

## Adim ici (Faz'in kendi Adimlari arasinda)
Onay BEKLENMEZ. Bir Adim bitip hizli dogrulamasi (tsc+lint+ilgili unit/entegrasyon testleri) yesil olunca Claude Code otomatik olarak **commit atar ve `origin/main`'e push eder** (D75), sonra kendiliginden bir sonraki Adim'a gecer (D78). Migration+kod ayni Adim'da degistiyse ayri commit'ler halinde push edilir.

## Faz kapanisinda (bir faz bitince)
1. **Senaryo listesi:** o fazin kapanisinda okunabilir bir senaryo listesi sunulur (eski manuel-test formatinda).
2. **Kosum onayi:** acikca sorulur — "bunlari siz test edebilirsiniz, ya da onay verirseniz ben yaparim." Onay gelmeden paket calistirilmaz.
3. **Otomatik kosum:** onay sonrasi tam paket (unit + entegrasyon x2 + E2E) calisir, sonuc katman/sonuc tablosu olarak sohbette ozetlenir (bkz. [[test-stratejisi]]).
4. **Bir sonraki faza gecis icin AYRICA onay beklenmez** (D79) — paket yesilse dogrudan bir sonraki fazin planlama/uygulamasina gecilir.

## Neden boyle (kisa gerekce)
Kullanici projeyi hizli bitirmeyi onceliklendirdi (D78: "faz adimlarinda onay almadan devam et", D79: "fazlar arasi da soru sorma"). Buyuk/mimari kararlar icin CLAUDE.md'nin genel "dur ve sor" esigi hala gecerli — bu sadece "fazi/adimi kapat, sonrakine gec" onay noktasini kaldiriyor.

## Kural karsiligi
RULES #43 (kapanis kriterleri + D79 ile onay kaldirildi), RULES #44 (E2E senaryolari silinemez), RULES #46 (Adim sonu commit+push otomatik, D75).

## Baglantili notlar
[[test-stratejisi]] · [[onay-sureci-kararlari]] · [[e2e-senaryolari]]
