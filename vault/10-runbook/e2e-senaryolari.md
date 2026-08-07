---
tags: [runbook, test, e2e, yasayan-liste]
ozet: "Kritik E2E senaryolarinin tam listesi (S1-S55+) — her faz kapanisinda buraya eklenir."
guncelleme: 2026-08-07
---

# Kritik E2E Senaryolari

> YASAYAN LISTE — TESTING.md'den (D-migration, 2026-08-01) buraya tasindi; artik tek dogru kaynak burasi. Her faz kapanisinda yeni senaryolar buraya eklenir, hicbiri silinmez/atlanmaz (RULES #44).

| # | Senaryo | Faz |
|---|---|---|
| S1 | Masa QR okut -> menu acilir -> varyant+ekstra ile urun ekle -> siparis ver -> KDS'de belirir | 1 |
| S2 | Onay modlu tenant: siparis garson onayina duser; onaysiz mutfaga gitmez | 1 |
| S3 | Tipsiz garson cagrisi -> garson panelinde israrci bildirim -> karsilandi | 1 |
| S4 | Iptal: pending'de serbest; preparing'de istek->garson onayi akisi | 1 |
| S5 | **Tenant izolasyonu (E2E):** A tenant menusunde B'nin urunu/siparisi asla gorunmez | 1 |
| S6 | Baglanti kopmasi: telefon offline->online; sepet korunur, cift siparis olusmaz (idempotency) | 1 |
| S7 | Kapali modul: route/API/navigasyonda gorunmez; dogrudan URL -> engellenir | 2 |
| S8 | Onboarding iki yol: demo veri kesfi + temizleme; sifirdan sihirbaz tamamlanir | 2 |
| S9 | Kasa: vardiya ac -> POS-lite siparis -> odeme al -> gun sonu sayim/fark raporu | 3 |
| S10 | Ikram/indirim: izinsiz personel yapamaz; sebep kodu zorunlu; kayip-kacak raporunda gorunur | 3 |
| S11 | Tam iade: online=iyzico iadesi, kasa=manuel kayit; rapora dogru yansir | 3 |
| S12 | Plan limiti: masa/sube limiti dolunca ekleme engellenir, yukseltme yonlendirmesi | 4 |
| S13 | Trial bitisi ve abonelik durum gecislerinde erisim davranisi | 4 |
| S14 | Super Admin: tenant askiya al -> tenant yuzeyleri kilitlenir | 4 |
| S15 | Destek ticket: tenant acar -> Super Admin yanitlar -> durum akisi | 4 |
| S16 | Cok dilli menu: dil degisimi fiyat/para birimi formatini bozmaz | 2 |
| S17 | Sube: ikinci sube acilinca secici belirir; sube override fiyati dogru uygulanir | 4+ |
| S18 | Hesap bolme (esit) ve bahsis akisi uctan uca | 3/6 |
| S19 | Degerlendirme: oturum kapaninca yildiz+yorum+garson puani istenir; 4-5* Google'a yonlenir, <=3* icerde kalir | 3 |
| S20 | Kayit: pazarlama sitesinden self-servis kayit -> yeni tenant olusur; ayni alt alan adi ikinci kez kullanilamaz | 4 |
| S21 | Donem Raporu: tarih araligi secilince toplam + gecen yil kiyasi guncellenir; `reports.loss` izni gerekir | 5 |
| S22 | Analitik paneli: widget'lar gorunur, surukle-birak sira/gizle-goster kullanici bazli kalici | 5 |
| S23 | Hedef: aylik ciro hedefi girilir, ilerleme gosterilir; anomali uyarisi panelde gorunur, onaylaninca kaybolur | 5 |
| S24 | Zamanlanmis rapor: "Simdi Gonder" ile anlik tetiklenir, PDF uretilip mock e-postaya kaydedilir | 5 |
| S25 | Kasa — kalem secerek odeme: hesap yalniz secilen kalemler odendiginde kapanir | 6 |
| S26 | Kasa — kismi iade: "kismen iade edildi" olur, kalan tutar icin ikinci kismi iade tam iadeye tamamlar | 6 |
| S27 | Kampanya/kupon: admin yuzde indirimli kampanya+kupon olusturur, misafir kupon uygular, indirim comps'a yazilir | 6 |
| S28 | Mutfak istasyon filtresi: kategoriye istasyon atanir, KDS'de sadece o istasyonun kalemleri gorunur | 6 |
| S29 | Tema yonetimi: admin+misafir tarafinda dogru `data-theme`; self-hosted `docker build`+`up` ile dogrulanir | 6 |
| S30 | Musteri kimligi: telefon+OTP+KVKK onayiyla sadakata katilir, mevcut oturum degismeden baglanir | 7 |
| S31 | Sadakat motoru: puan modu ayarlanir, bakiye indirim olarak kullanilir, comps'a yazilir | 7 |
| S32 | Hediye karti: admin kart olusturur, kasa kartla odeme alir, bakiye duser hesap kapanir | 7 |
| S33 | Sadakat/kampanya performans raporu: kazanim/harcama, aktif musteri, kullanim sayilari dogru | 7 |
| S34 | Recete dusumu: admin malzeme+recete tanimlar; kasadan siparis verilince stok otomatik duser | 8 |
| S35 | Tedarik: tedarikci+alim girisi; stok artar, hareketli ortalama maliyet dogru guncellenir | 8 |
| S36 | Fire/sayim: fire kaydi stok duser, fiziksel sayim esitler; kritik seviye altindakiler ozetlenir | 8 |
| S37 | Menu muhendisligi matrisi: satislar popülerlik x marj ile Yildiz/Beygir/Bilmece/Zayif ayrilir | 8 |
| S38 | Gel-Al: misafir baglantidan siparis verir, teslim kodu gorur; mutfak hazir isaretleyince bildirim | 9 |
| S39 | Paket servis: bolge secilir, adres girilir; bolge ucreti eklenir, min sepet alti reddedilir | 9 |
| S40 | Kurye modulu: garson panelinden kurye atanir; kurye Atandi->Yolda->Teslim Edildi ilerletir | 9 |
| S41 | Tenant API: gercek anahtar yalniz kendi siparislerini doner; anahtarsiz/iptal 401 | 10 |
| S42 | Webhook'lar: kayit + imza sirri gorunur; olay HMAC imzali POST ile teslim (5xx->retry) | 10 |
| S43 | Pazar yeri: SKU eslemesi kurulur, API ile siparis `approved` KDS'e duser, idempotent, esiz SKU reddedilir | 10 |
| S44 | Muhasebe: `served` siparis mock saglayiciya gonderilir, RLS baska tenant'i gizler | 10 |
| S45 | Rezervasyon+bekleme: pending->confirmed->seated; walk-in called->seated; RLS izole | 11 |
| S46 | Kiosk modu: pairing code, oturuma kiosk_device_id islenir, "Siradaki Musteri" yeni oturum acar | 11 |
| S47 | Vardiya+puantaj: cihaz secret + PIN in/out; yanlis PIN/iptal cihaz reddedilir; CSV export | 11 |
| S48 | Garson — masa tasima: `session.move` izinli tasir, audit kaydi; izinsizde bolum hic gorunmez | genel |
| S49-S55 | Faz 4 revizyonu (plan_modules RLS, plan yonetimi, onay kuyrugu, kapali kapi kayit, elle modul, dusurme incelemesi, Talep Et) | Faz 4 rev. |
| S56 | Elle odeme (D101): super admin "Odemesi alindi" der, trial'i dolmus tenant aninda serbest kalir (havale/EFT — saglayici checkout'undan gecmeyen tahsilat) | 24 |

## Baglantili notlar
[[test-stratejisi]] · [[faz-kapanis-ve-onay-akisi]]
