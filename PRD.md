# PRD.md — Kafe & Restoran Yönetim Platformu (SaaS)

> Ürün Gereksinim Dokümanı — v3.0 (100k$ kriter analizi sonrası)
> Birlikte oku: `ARCHITECTURE.md`, `PLAN.md`, `CLAUDE.md`, `RULES.md`, `OPERATIONS.md`, `DECISIONS.md`

---

## 1. Vizyon ve Temel İlke

QR tabanlı sipariş deneyimini merkeze alan, **premium görünümlü**, çok kiracılı ve **çok şubeli** bir kafe/restoran yönetim SaaS platformu.

**Dinamik Ölçeklenme İlkesi (ürünün anayasası):** Çekirdek deneyim sade bir QR menüdür. Diğer her yetenek — kasa, stok/reçete, CRM, sadakat, kampanya, paket servis, kurye, rezervasyon, kiosk, vardiya, hediye kartı, entegrasyonlar — tenant'ın admin panelden **aktif/pasif ettiği modüllerdir**. Kapalı modül hiçbir ekranda görünmez. "Sadece dijital menü" isteyen kafe sade bir sistem görür; tam kapsamlı restoran isteyen tüm modülleri açar. Onboarding "Neye ihtiyacın var?" adımıyla modülleri ön-yapılandırır.

## 2. Kullanıcı Rolleri ve İzinler

Roller: **Müşteri (guest)** · **Garson** · **Mutfak** · **Kurye** · **Kafe Manager** · **Kafe Owner** · **Süper Admin (platform)**.

- **İzin bayrakları:** Sabit rollerin üstünde tenant'ın ayarladığı izin anahtarları: ikram/indirim yetkisi, iade yetkisi, rapor grubu erişimleri, menü düzenleme, kasa açma/kapama, masa taşıma, rezervasyon yönetimi vb. (Özel rol oluşturma: gelecek faz, bayrakların üstüne inşa edilir.)
- **Girişler:** Owner/Manager e-posta+şifre (+opsiyonel TOTP 2FA); garson/mutfak/kurye yetkili cihazlarda **vardiya modu + PIN**. 2FA zorunluluğu platform anahtarıyla Süper Admin kontrolündedir (varsayılan: opsiyonel).

## 3. Şube (Branch) Mimarisi

- Tenant → **şubeler** → masalar/siparişler/kasa. Her tenant görünmez tek şubeyle başlar; ikinci şube açıldığında paneller şube seçicili çok şubeli moda geçer (migration gerektirmez).
- **Merkezi menü + şube override:** Menü tenant seviyesinde tek yerden yönetilir; şube bazında fiyat farkı, şube stoğu ve "bu şubede satılmıyor" override'ları yapılır.
- Konsolide + şube bazlı raporlama. Personel şubeye atanır (çoklu şube ataması mümkün).
- **Plan ilişkisi:** Plana dahil şube sayısı + üstü aylık ek ücretle açılır.

## 4. QR Menü (Müşteri Tarafı)

*(v2.0 kararları aynen geçerli — özet:)* `warm-luxury` teması (lüks+sıcak; espresso/antrasit + krem + altın), dengeli mikro animasyonlar, kategori başına esnek düzen (grid/liste/vitrin), çok dilli, tenant para birimi. İki QR tipi: **masa QR** (doğrudan oturum) ve **genel QR** (masa seçtirir); tema uyumlu, çoklu formatlı yazdırılabilir baskı şablonları. Varyant/ekstra/alerjen/stok ("Tükendi"), sepet koruması + idempotency, karma iptal (serbest → iptal isteği), oturum görünümü (tüm siparişler + ara toplam + cihaz etiketi + Hesap İste), **sticky Garson Çağır** (tipsiz tek dokunuş + standart ve tenant özel tipleri), "hazır" için ses/titreşim (+Web Push gelecek faz), değerlendirme (yıldız+yorum, garson puanlama isim/yaka/foto — tenant ayarlı, Google köprüsü: 4-5★ yönlenir, düşük puan içeride + admin uyarısı).

## 5. Sipariş Kanalları (Modül)

Tüm siparişler tek motor, `order_channel` ile ayrışır: `dine_in` · `pickup` · `delivery` · `marketplace`.
- **Gel-Al (pickup):** Menü linkinden sipariş → hazır bildirimi → teslim kodu.
- **Kendi Kurye Paketi (delivery):** Adres, teslimat bölgeleri, bölge bazlı ücret ve min. sepet; **zamanlanmış sipariş** ("13:00'te hazır olsun").
- **Kurye modülü (opsiyonel):** `courier` rolü, siparişe kurye atama, yolda→teslim akışı, kurye gün sonu özeti. (Canlı harita takibi: gelecek kapısı.)
- **Pazar yeri entegrasyonları (opsiyonel modül):** Yemeksepeti/Getir/Trendyol GO — adaptör mimarisi; doğrudan API veya aracı katman sağlayıcısı — **karma strateji (D70):** aracı katman sağlayıcısıyla hızlı çıkış, platform onayları geldikçe doğrudan API'ye kademeli geçiş. Gelen siparişler kanal etiketiyle aynı KDS/panele düşer.

## 6. Operasyon Panelleri

- **Garson Paneli:** çağrılar (open→ack→resolved, yanıt süresi), onay/iptal kuyruğu, hazır siparişler, masa haritası, **masa taşıma** (yalnız personel), rezervasyon görünümü (modül açıksa).
- **KDS:** kanal etiketli sipariş kartları, süre/gecikme renkleri, `preparing→ready`; istasyon altyapısı (Bar/Mutfak) şemada hazır, istasyon ekranları kendi fazında açılır.
- **Bildirimler:** olay tipine göre sesler + cihaz başına ayar + kritik olaylarda **ısrarcı tekrar modu**; bağlantı göstergesi + otomatik senkron.

## 7. Kasa Modülü (POS)

- **Vardiya bazlı kasa:** açılış bakiyesi → satışlar → kapanış nakit sayımı → beklenen/fark raporu (açık-fazla).
- **POS-lite sipariş girişi:** QR kullanmayan müşteri, telefon siparişi ve tezgâh satışı için kasadan hızlı sipariş; masaya veya "tezgâh" hesabına yazılır.
- **Gün sonu raporu (Z benzeri):** ciro, ödeme kırılımı, iptal/ikram/iade dökümü, kanal kırılımı; muhasebe exportlarına kaynaklık eder.
- **İkram/indirim (comp/void):** izin bayrağına bağlı; **sebep kodu zorunlu**; kayıp-kaçak raporuna işlenir.
- **İade:** tam sipariş iadesi (online = iyzico API'den gerçek iade; kasa = manuel kayıt) + sebep kodu; **kısmi/kalem iade** hesap bölmeyle aynı fazda.
- **Donanım paketi (gelecek faz, adaptör kapısı baştan):** termal fiş yazıcısı (ESC/POS), para çekmecesi, barkod okuyucu; mutfak yazıcısı aynı pakette.

## 8. Stok, Reçete ve Maliyet (Modül)

- **Hibrit stok:** ürün başına mod seçimi — "basit adet" veya "reçeteden düş" (malzeme gramajı otomatik düşer). Şema (malzemeler, reçeteler, stok hareketleri) baştan; reçete UI'ı kendi fazında.
- **Tedarik:** basit alım girişi (stok + hareketli ortalama maliyet) önce; tam satın alma (tedarikçi kartı, PO, mal kabul) ileri faz.
- **Maliyet/kârlılık:** manuel maliyet + marj raporu erken; reçete açılınca otomatik maliyet + **menü mühendisliği matrisi** (Yıldız/Beygir/Bilmece/Zayıf + aksiyon önerileri).

## 9. CRM, Sadakat ve Kampanya (Modüller)

- **Müşteri kimliği:** menü anonim akar; müşteri isterse **telefon + OTP** ile sadakat hesabı açar (asla zorunlu değil). KVKK onayları kayıt altında.
- **Sadakat motoru (modüler):** tenant **damga** (ürün/kategori kurallı — "9 kahveye 1 bedava") veya **puan** modelini seçer; kademe (tier) gelecek fazda motorun üstüne.
- **Kampanya/kupon:** Pricing Rules motoru üstünde kural bazlı kampanyalar ("2 al 1 öde", saat aralığı, kategori kısıtı, kullanım limiti) + kupon kodları. **Segmentli hedefleme** (örn. "30 gündür gelmeyene %15") CRM verisi sonrası, İYS uyumlu iletişim modülüyle.
- **Hediye kartı (modül):** ön ödemeli bakiye satışı ve harcaması; bakiye muhasebesi (müşteriye borç) raporlarda ayrı izlenir.

## 10. Analitik Merkezi

Ayrı bölüm (rol/izin bayraklarıyla erişim):
- **Widget dashboard:** sürükle-bırak kartlar (canlı ciro, sipariş sayacı, saatlik heatmap, en çok satanlar, şube kıyası...).
- **Hedefler & akıllı uyarılar:** ciro hedefi takibi; anomali uyarıları ("bugünkü ciro geçen 4 haftanın aynı gününe göre %30 düşük").
- **Zamanlanmış raporlar:** günlük/haftalık özetin otomatik e-posta/PDF gönderimi.
- **Rapor seti:** ciro (dönem + geçen yıl kıyası), en çok satanlar, saatlik yoğunluk, masa/şube performansı, garson performansı (yanıt süresi + puan), ödeme ve kanal kırılımı, iptal/ikram/iade (sebep kodlu kayıp-kaçak), kâr marjı → menü mühendisliği, sadakat/kampanya performansı, değerlendirmeler.
- **Veri geçmişi sınırsız**; tüm raporlarda dönem karşılaştırma. CSV/Excel + muhasebe programı uyumlu (Logo/Mikro/Paraşüt şablonları) export; doğrudan muhasebe API adaptörü ileri faz; **ÖKC adaptör kapısı** mimaride.

## 11. Ek Modüller

- **Rezervasyon + bekleme listesi:** online rezervasyon, masa haritası entegrasyonu, bekleme listesi ve çağırma.
- **Kiosk modu:** tablet self-servis sipariş (QR menünün dokunmatik/büyük ekran modu; kod yeniden kullanımı).
- **Vardiya planlama + puantaj:** haftalık çizelge, PIN ile giriş-çıkış (mevcut vardiya PIN'i puantaja uzanır), çalışma saati raporu, maaş dönemi exportu.

## 12. Süper Admin ve SaaS Katmanı

- Tenant/şube yönetimi, kullanım istatistikleri, **modül yönetimi** (varsayılan modül setleri, plan-modül eşleşmesi).
- **Planlar:** Başlangıç/Pro/Sınırsız — masa+şube limitli; **taslak: Başlangıç 10 masa/1 şube · Pro 25 masa/2 şube · Sınırsız ∞ masa/3 şube dahil** (+ek şube aylık ücret; kesin fiyatlar lansmanda). 14 gün kartsız tam trial. + **Lifetime** ve **Self-hosted (yıllık lisans)**; lisans anahtarı üretimi/doğrulama.
- Tema yönetimi (public/private), faturalama, **2FA zorunluluk anahtarı**, bakım duyuruları.
- **Destek merkezi:** tenant panelden destek talebi (ticket) açar; Süper Admin kuyruğunda durum yönetimi (açık → yanıtlandı → çözüldü), talep geçmişi. Yardım Merkezi gelecek kapısı.
- **Tenant API & Webhooks:** API key yönetimi, imzalı webhooks (sipariş/ödeme/çağrı olayları), read-only API; yazma API'si pazar yeri altyapısıyla.

## 13. Pazarlama Sitesi

Landing + özellikler + **modüler yapıyı anlatan** kurgu ("QR menüyle başla, restorana ölçeklen") + fiyatlandırma (3 plan + modüller + lifetime/self-hosted "iletişime geç") + kayıt → onboarding: **"Demo veriyle keşfet"** (toplu temizleme) / **"Sıfırdan kur"** (logo→dil→para birimi→masalar→şablon menü→**modül seçimi**→tema önizleme). TR/EN. Yasal: KVKK, çerez, sözleşmeler, veri silme akışı; status sayfası bağlantısı.

## 14. Kapsam Dışı / Gelecek Kapıları
Native mobil + push, donanım paketi (termal/çekmece/barkod/ÖKC), canlı kurye takibi, çoklu kur gösterimi, özel rol oluşturma, segmentli kampanya (CRM sonrası), tam PO, kademe sadakat, tam pricing rules editörü, Yardım Merkezi (makale/video kütüphanesi). **Kapsam dışı kesinleşti:** Wi-Fi portalı (D69).

## 15. Başarı Kriterleri
Olaylar panellere < 3 sn · QR menü LCP < 2.5 sn · RLS izolasyonu test kanıtlı · ısrarcı bildirim kaçırılamaz · kapalı modül hiçbir yüzeyde iz bırakmaz · gün sonu raporu kasa gerçeğiyle mutabık.
