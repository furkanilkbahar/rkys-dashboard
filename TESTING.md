# TESTING.md — Test Stratejisi v1.0

## 1. Katmanlar ve Araçlar
| Katman | Araç | Kapsam |
|---|---|---|
| Birim | Vitest | Saf fonksiyonlar: fiyat/KDV hesabı, sepet toplamı, pricing rules, lisans doğrulama, izin (`can()`) mantığı |
| Entegrasyon | Vitest + lokal Supabase | RLS izolasyonu, sipariş durum makinesi, stok düşümü, modül guard'ları — gerçek lokal DB'ye karşı |
| E2E | Playwright | Kritik kullanıcı akışları, gerçek tarayıcıda (mobil viewport dahil) |

- Test altyapısı (Vitest + Playwright + örnek testler) **Faz 0'da** kurulur.
- CI her PR'da **tüm test paketini** koşar → regresyon otomatik yakalanır. Kırmızı testle merge yok (RULES 22/43).

## 2. Faz Kapanış Kriteri (Definition of Done)
Bir faz şunlar olmadan kapanmaz:
1. Fazın yeni özelliklerinin birim/entegrasyon testleri yazıldı.
2. Faza ait E2E senaryoları (aşağıdaki listeden ilgili olanlar) Playwright'ta geçiyor; daha önce sohbette sunulan manuel test maddeleri varsa karşılığı otomatik teste dönüştürülür (bkz. §5).
3. **Önceki tüm fazların testleri dahil** paket yeşil.
4. Claude Code otomatik test paketinin sonucunu sohbette özetler; **fazlar arası geçiş kullanıcı onayına tabidir** (D73) — faz içindeki adımlar için ayrıca onay beklenmez.

## 3. Kritik E2E Senaryoları (yaşayan liste — her fazda genişletilir)
| # | Senaryo | Faz |
|---|---|---|
| S1 | Masa QR okut → menü açılır → varyant+ekstra ile ürün ekle → sipariş ver → KDS'de belirir | 1 |
| S2 | Onay modlu tenant: sipariş garson onayına düşer; onaysız mutfağa gitmez | 1 |
| S3 | Tipsiz garson çağrısı → garson panelinde ısrarcı bildirim → karşılandı | 1 |
| S4 | İptal: pending'de serbest; preparing'de istek→garson onayı akışı | 1 |
| S5 | **Tenant izolasyonu (E2E):** A tenant menüsünde B'nin ürünü/siparişi asla görünmez | 1 |
| S6 | Bağlantı kopması: telefon offline→online; sepet korunur, çift sipariş oluşmaz (idempotency) | 1 |
| S7 | Kapalı modül: route/API/navigasyonda görünmez; doğrudan URL → engellenir | 2 |
| S8 | Onboarding iki yol: demo veri keşfi + temizleme; sıfırdan sihirbaz tamamlanır | 2 |
| S9 | Kasa: vardiya aç → POS-lite sipariş → ödeme al → gün sonu sayım/fark raporu | 3 |
| S10 | İkram/indirim: izinsiz personel yapamaz; sebep kodu zorunlu; kayıp-kaçak raporunda görünür | 3 |
| S11 | Tam iade: online=iyzico iadesi, kasa=manuel kayıt; rapora doğru yansır | 3 |
| S12 | Plan limiti: masa/şube limiti dolunca ekleme engellenir, yükseltme yönlendirmesi | 4 |
| S13 | Trial bitişi ve abonelik durum geçişlerinde erişim davranışı | 4 |
| S14 | Süper Admin: tenant askıya al → tenant yüzeyleri kilitlenir | 4 |
| S15 | Destek ticket: tenant açar → Süper Admin yanıtlar → durum akışı | 4 |
| S16 | Çok dilli menü: dil değişimi fiyat/para birimi formatını bozmaz | 2 |
| S17 | Şube: ikinci şube açılınca seçici belirir; şube override fiyatı doğru uygulanır | 4+ |
| S18 | Hesap bölme (eşit) ve bahşiş akışı uçtan uca | 3/6 |

## 4. RLS İzolasyon Testleri (entegrasyon, zorunlu şablon)
Her yeni tablo için otomatik üretilen test çifti:
- A tenant'ı olarak B'nin satırı SELECT/UPDATE/DELETE edilemez.
- branch_id'li tablolarda yetkisiz şube erişimi engellenir.

## 5. Faz Kapanış Doğrulaması (otomatik — D73)
- Manuel el testi zorunlu değildir; kullanıcı manuel test yapmak istemez (kullanıcı kararı, 2026-07-20).
- Bunun yerine: eskiden manuel listede yer alacak her senaryo (tenant izolasyonu, login akışı, modül guard'ı, kritik sayfa render'ı vb.) bir Playwright E2E testine dönüştürülür ve `tests/e2e/` altına eklenir.
- Faz sonunda Claude Code tüm paketi (`pnpm test` + `pnpm exec playwright test`) koşturur; sonucu (geçen/kalan test sayısı) sohbette özetler.
- Gerçek cihaz/görsel kontrol otomatikleştirilemez — bloklayıcı değildir, kullanıcı isterse ayrıca kendi yapar.
- Paket yeşilse Claude Code faz geçişi için onay ister; **onay olmadan bir sonraki faza geçilmez**. Faz içindeki uygulama adımları için ayrıca onay beklenmez (kullanıcı kararı; Faz 4'te tekrar değerlendirilecek).

## 6. Kapsam Dışı (bilinçli)
- %100 kapsama hedefi yok; hedef **kritik akışların** korunması.
- Görsel piksel-regresyon testi, yük/performans testi → Faz 12 havuzu.
