# RULES.md — Kesin Kurallar ve Yasaklar

> Bu kurallar tüm fazlarda geçerlidir. İhlal edilecekse ÖNCE kullanıcıdan açık onay alınır.

## 🔒 Güvenlik & Multi-Tenancy (en kritik)
1. **RLS'siz tablo YASAK.** Her tablo oluşturulduğu migration içinde RLS aktif + politikalar tanımlı olmalı.
2. **`tenant_id` filtresiz sorgu YASAK.** (RLS olsa bile savunma katmanı olarak veri katmanında tenant scope zorunlu.)
3. **`service_role` key client'a asla sızmaz.** Sadece server-side (Route Handler / Edge Function) kullanılır.
4. Secret'lar (API key, lisans imza anahtarı, iyzico anahtarları) **asla commit edilmez**; yalnızca env. `.env*` dosyaları `.gitignore`'da kalır.
5. Müşteri (anon) tarafından yazma işlemleri yalnızca **imzalı masa token'ı doğrulayan** RPC/Edge Function üzerinden yapılır; tablolara doğrudan anon insert yasak.
6. Ödeme webhook'ları imza doğrulaması olmadan işlenmez.
7. QR kodları ve token'lar tahmin edilebilir (ardışık, kısa) değerlerle üretilmez.
8. Sipariş ve çağrı endpoint'lerinde rate limiting atlanmaz.

## 🧱 Kod Kalitesi
9. `any` tipi yasak (kaçınılmazsa `unknown` + daraltma). `@ts-ignore` yasak (`@ts-expect-error` + açıklama istisna).
10. Doğrulanmamış dış girdi (Zod'suz form/API/webhook verisi) işlenmez.
11. UI'da hardcoded kullanıcı metni yasak — her metin i18n'den gelir.
12. Para hesapları float ile yapılmaz — integer kuruş zorunlu.
13. Tenant'a özel `if (tenant === 'x')` koşulları yasak — davranış farklılıkları ayar/tema/plan üzerinden yönetilir.
14. Ölü kod, kullanılmayan bağımlılık ve "sonra sileriz" geçici hack'ler bırakılmaz.

## 🗄️ Veritabanı
15. Dashboard'dan elle şema değişikliği yasak — sadece migration.
16. Migration geriye dönük veri kaybettiriyorsa (drop/rename) önce kullanıcı onayı.
17. Üretim verisini silen/değiştiren script'ler onaysız çalıştırılmaz.
18. Sipariş geçmişi (orders, order_items, payments) hiçbir işlemde silinmez/yeniden hesaplanmaz — düzeltmeler yeni kayıtla yapılır.

## 🔁 Süreç
19. Faz atlamak, kapsam dışı özellik eklemek yasak — öneri olarak sunulabilir, onaysız yapılmaz.
20. Mimari bir karar değiştirilecekse önce `ARCHITECTURE.md` güncellenir ve onay alınır.
21. Kütüphane eklemeden önce mevcut stack ile çözülüp çözülemeyeceği değerlendirilir; büyük bağımlılıklar onaya sunulur.
22. Çalışan bir akışı bozan refactor, testler yeşile dönmeden commit edilmez.

## 📦 Ürün Davranışı
23. Stoğu biten ürün sepete eklenemez — bu kontrol hem UI'da hem server'da yapılır (yalnızca UI yeterli değildir).
24. Sipariş durum geçişleri durum makinesine aykırı yapılamaz (örn. `pending → served` atlaması yasak).
25. Bir tenant'ın personeli başka tenant'ın paneline hiçbir koşulda erişemez.
26. Private tema, atanmadığı tenant'ın tema listesinde asla görünmez.

## 🆕 v2.0 Ek Kurallar
27. Masa taşıma (session move) işlemi müşteri arayüzünde hiçbir koşulda sunulmaz — yalnızca personel RPC'si.
28. Plan masa limiti yalnızca UI'da değil DB düzeyinde de (trigger/RPC) uygulanır.
29. Vardiya PIN'leri düz metin saklanmaz (hash); yetkisiz cihazda PIN girişi çalışmaz.
30. Düşük müşteri puanları (≤3★) hiçbir akışta Google'a yönlendirilmez.
31. Sipariş gönderimi idempotency_key olmadan kabul edilmez (çift sipariş yasak).
32. Genel QR akışında masa seçimi yapılmadan sipariş/çağrı oluşturulamaz.

## 🆕 v3.0 Ek Kurallar
33. Yeni operasyonel tablo `branch_id` olmadan oluşturulamaz; şube filtresi veri katmanında zorunlu.
34. Modül kapalıysa ilgili route/API/navigasyon erişilemez olmalı — sadece UI'da gizlemek yetmez, server tarafında da engellenir.
35. İkram/indirim/iade işlemleri sebep kodu olmadan kaydedilemez; sebep kodları raporlardan izlenebilir kalır.
36. Kasa vardiyası kapatılmadan yeni vardiya açılamaz; gün sonu snapshot'ı (`day_closures`) üretildikten sonra o günün kayıtları değiştirilemez (düzeltme = yeni kayıt).
37. Hediye kartı bakiyesi negatife düşürülemez; bakiye hareketleri yalnızca transaction kayıtlarıyla değişir.
38. OTP/SMS uçlarında rate limit zorunlu; müşteri telefon numaraları maskeli gösterilir, export'larda izinsiz yer almaz.
39. Reçete düşümü yalnızca server-side yapılır; client stok yazamaz.
40. Webhook gönderimleri HMAC imzasız yapılamaz; imza anahtarları tenant başına ayrıdır.
41. İzin bayrağı kontrolü olmadan yetkili işlem (comp, refund, kasa, masa taşıma, rapor) çalıştırılamaz — `can()` katmanı atlanamaz.
42. AÇIK KARAR kapatılmadan ilgili geliştirmeye başlanmaz (güncel durum DECISIONS.md'de; şu an bloklayıcı açık karar yok — D66 SMS sağlayıcı seçimi Faz 7'ye ertelendi, D71 isim/domain kapatıldı); karar önce DECISIONS.md'ye işlenir.
43. Bir faz, TESTING.md'deki kapanış kriterleri (yeni testler + tüm eski testler yeşil + kullanıcı el testi onayı) sağlanmadan kapanmaz.
44. TESTING.md'deki kritik E2E senaryoları silinemez/atlanamaz; yeni kritik akış eklendiğinde senaryo listesi güncellenir.
45. **Production'a erken çıkış YASAK:** Proje lokalde uçtan uca tamamlanıp kullanıcı onayı alınmadan Vercel/Supabase Cloud production ortamına hiçbir deploy yapılmaz; staging ortamının açılması da kullanıcı onayına tabidir (D72).
