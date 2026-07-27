# DECISIONS.md — Karar Günlüğü

> Planlama oturumlarında alınan kararlar ve gerekçeleri. Claude Code bir davranışın "neden böyle" olduğunu buradan doğrular. Yeni kararlar tarihiyle eklenir; karar değişirse eskisi silinmez, "revize edildi" notu düşülür.

## Oturum 1 — Kapsam ve Temel Mimari (2026-07)

| # | Karar | Gerekçe |
|---|---|---|
| D1 | Mobil uygulama ertelendi; her şey web tabanlı, push yerine panel içi sesli bildirim | Basit başlangıç; ileride PWA→native yolu açık |
| D2 | Ödeme: kasada + online (iyzico), tenant seçimli | Esneklik |
| D3 | Baştan multi-tenant SaaS | Satılabilir ürün hedefi; RLS izolasyonu temel |
| D4 | 3 personel yüzeyi: Admin + KDS + Garson paneli | Rol bazlı odaklı ekranlar |
| D5 | Stack: Next.js + Supabase | Hız + Realtime + RLS uyumu |
| D6 | Çok dilli altyapı; tenant dillerini seçer | Uluslararası satış kapısı |
| D7 | Süper Admin baştan; abonelik + **lifetime** + **self-hosted (yıllık lisans)** modelleri | Esnek gelir modelleri; lisans anahtarı altyapısı gerekir |
| D8 | Ürün yapısı: varyant + ekstra + stok | Zengin menü ihtiyacı |
| D9 | Tek premium tema ile başla; tema altyapısı public/**private (tenant'a özel)** atamalı | Müşteriye özel tema satabilme |
| D10 | Sipariş modu tenant ayarlı: `direct` / `approval` | Farklı işletme alışkanlıkları |
| D11 | Tam pazarlama sitesi (tanıtım+fiyat+kayıt) | SaaS satış kanalı |
| D12 | Detaylı raporlama | Karar destek + satış argümanı |

## Oturum 2 — Detaylandırma (2026-07)

### Tasarım
| # | Karar | Gerekçe |
|---|---|---|
| D13 | Tema kimliği: **`warm-luxury`** — lüks + sıcak karışımı (espresso/antrasit + krem + altın) | "Aşırı koyu olmasın" talebi; gündüz okunabilirlik |
| D14 | Ürün düzeni esnek: grid / liste / vitrin şeridi; **admin kategori başına seçer** (ayar Faz 2) | Her menü tipine uyum |
| D15 | Animasyon: dengeli mikro animasyonlar | Premium his + performans |

### Fiyatlandırma
| # | Karar | Gerekçe |
|---|---|---|
| D16 | 3 plan: Başlangıç / Pro / Sınırsız | Sade karar, klasik SaaS |
| D17 | Limit **yalnızca masa sayısı**; tüm özellikler her planda açık | En anlaşılır metrik |
| D18 | 14 gün tam özellikli trial, **kart istenmez** | Sıfır giriş bariyeri |

### Ödeme & Hesap
| # | Karar | Gerekçe |
|---|---|---|
| D19 | Hesap bölme fazlı: tek ödeme + eşit bölüşme (Faz 3), kalem bazlı (Faz 5); tenant hangilerini açacağını seçer | Riski dağıtma |
| D20 | Bahşiş: hazır tutar çipleri (50/100/200/300/400/500₺, **tenant düzenler**) + özel tutar | Hızlı seçim, yazma derdi yok |
| D21 | Varsayılan: KDV dahil net fiyat, sıfır ek ücret; **Pricing Rules motoru** altyapısı (servis ücreti, mutlu saat, paket farkı) tenant isterse aktive eder — temel motor Faz 5 | Şeffaflık + gelecek esnekliği |

### Sipariş Akışı
| # | Karar | Gerekçe |
|---|---|---|
| D22 | İptal karma: `pending/approved` serbest; `preparing` sonrası **iptal isteği** garson onaylı | Müşteri özgür, mutfak korunur |
| D23 | Oturum: otomatik açılış + ödeme/timeout/manuel kapama; **masa taşıma sadece garson yetkisi** (müşteride görünmez) | Kendi kendine düzelen sistem + saha ihtiyacı |
| D24 | Müşteri görünümü: tüm oturum siparişleri + ara toplam + Hesap İste + **cihaz bazlı etiket** | Şeffaflık; kalem bazlı bölmeye temel |

### Erişim & Onboarding
| # | Karar | Gerekçe |
|---|---|---|
| D25 | URL: subdomain + custom domain kapısı | Premium imaj + ileride üst plan özelliği |
| D26 | Giriş karma: admin e-posta+şifre; garson/mutfak **yetkili cihazda vardiya modu + PIN** | Güvenlik + saha hızı |
| D27 | Onboarding iki yol: **"Demo veriyle keşfet"** (toplu demo temizleme butonuyla) veya **"Sıfırdan kur"** tam sihirbazı (logo→dil→para birimi→masalar→şablon menü→tema önizleme) | Hem hızlı fikir hem temiz kurulum |

### Bildirim, QR, Dayanıklılık
| # | Karar | Gerekçe |
|---|---|---|
| D28 | Sesler olay tipine göre + cihaz başına ayar + kritik olaylarda **ısrarcı tekrar modu** | "Garson duymadı" senaryosunu öldürmek |
| D29 | **İki QR tipi:** masa QR'ı (doğrudan oturum) + genel QR (**masa seçtirir**); baskı şablonları çoklu format + tema uyumlu | Tek QR bastırma esnekliği + görsel bütünlük |
| D30 | Dayanıklılık: reconnect+senkron, bağlantı göstergesi, sepet koruması, idempotency | Kafe Wi-Fi gerçeği |

### Müşteri Deneyimi
| # | Karar | Gerekçe |
|---|---|---|
| D31 | Değerlendirme: dahili yıldız+yorum; 4-5★ → Google köprüsü, düşük puan içeride + admin uyarısı; **garson puanlama** (isim/yaka no/foto gösterimi tenant ayarlı) | Google puanı büyütme + personel ölçümü |
| D32 | Görseller: telifsiz hazır kütüphane + otomatik optimizasyon (WebP) | Boş menü olmasın + LCP hedefi |
| D33 | "Hazır" bildirimi: şimdi ses/titreşim+sekme uyarısı; Web Push Faz 6 | iOS sürtünmesini erteleme |
| D34 | KVKK/çerez/sözleşmeler + veri silme akışı kapsama alındı | Yasal zorunluluk |

### Operasyon
| # | Karar | Gerekçe |
|---|---|---|
| D35 | Çağrı tipleri: standart set + tenant özel tip + **tipsiz tek dokunuş çağrı** | Konsepte uyum + en hızlı yol |
| D36 | Para birimi: tenant tek birim seçer; çoklu kur gösterimi gelecek faz | Uluslararası kapı, düşük maliyet |
| D37 | Mutfak istasyonları: şema baştan hazır (`station`), v1 tek ekran, istasyon ekranları Faz 5 | Bugün basit, yarın hazır |

## Oturum 3 — 100k$ Kriter Analizi ve Kapsam Genişletme (2026-07)

### Ürün Anayasası
| # | Karar | Gerekçe |
|---|---|---|
| D38 | **Dinamik Ölçeklenme İlkesi + Modül Sistemi** (`tenant_modules`): çekirdek = QR menü; kasa, stok, CRM, kanallar, rezervasyon, kiosk, vardiya, hediye kartı vb. tenant'ın açıp kapattığı modüller; kapalı modül hiçbir yüzeyde görünmez | "Sadece QR menü isteyene de tam restoran yönetimi isteyene de hizmet" talebi |

### Şube
| # | Karar | Gerekçe |
|---|---|---|
| D39 | Şube: şema tam + görünmez tek şube + hazır seçici altyapısı | Migration acısını bugünden sıfırlama |
| D40 | Merkezi menü + `branch_product_overrides` (fiyat/stok/satılmıyor) | Zincir standardı |
| D41 | Plan: dahil şube sayısı + ek şube aylık ücret | Sade + ölçeklenen gelir |

### Kasa & Finans
| # | Karar | Gerekçe |
|---|---|---|
| D42 | Kasa modülü: vardiya kasa (açılış/sayım/fark) + **POS-lite sipariş girişi** + gün sonu snapshot (Faz 3); **donanım paketi ayrı fazda** (termal/çekmece/barkod, adaptör kapısı baştan) | QR kullanmayan müşteri gerçeği; donanım sürücüleri çekirdeği bekletmesin |
| D43 | İkram/indirim: izin bayrağı + **zorunlu sebep kodu** → kayıp-kaçak raporu | Suistimal görünürlüğü |
| D44 | İade fazlı: tam iade Faz 3 (online=iyzico gerçek iade, kasa=manuel); kısmi/kalem iade Faz 6 (hesap bölmeyle ortak altyapı) | Riskli karmaşıklığı fazlama |

### Stok & Maliyet
| # | Karar | Gerekçe |
|---|---|---|
| D45 | **Hibrit stok:** ürün başına `simple` / `recipe` modu; malzeme+reçete şeması baştan, reçete UI Faz 8 | Kolay başla, olgunlaş |
| D46 | Tedarik fazlı: basit alım+hareketli ortalama maliyet önce; tam PO ileri faz | Maliyet verisinin temeli |
| D47 | Kârlılık fazlı: manuel maliyet+marj erken (Faz 3); reçeteyle **otomatik maliyet + menü mühendisliği matrisi** (Faz 8) | Erken değer + imza rapor |

### CRM & Pazarlama
| # | Karar | Gerekçe |
|---|---|---|
| D48 | Müşteri kimliği: **telefon+OTP sadakat hesabı**, tamamen opsiyonel; menü anonim akmaya devam eder | Sürtünmesiz deneyim korunur |
| D49 | Sadakat: modüler motor — tenant damga/puan seçer; kademe ileri faz | Kafe kültürüne uyum |
| D50 | Kampanya fazlı: kural bazlı (Pricing Rules üstünde, Faz 6); segmentli+İYS iletişimi CRM sonrası | Aynı altyapı, doğru sıra |
| D51 | **AÇIK KARAR — Pazar yeri bağlantı biçimi:** adaptör mimarisi kesin; doğrudan platform API'leri mi (iş ortaklığı onayı gerekir) yoksa aracı katman sağlayıcısı mı — onay süreçleri/maliyet netleşince | API erişimleri izne tabi |
| D52 | Hediye kartı modülü plana alındı (bakiye=borç muhasebesiyle) | Ön nakit + sadakat sinerjisi |

### Kanallar
| # | Karar | Gerekçe |
|---|---|---|
| D53 | `order_channel` şeması baştan; gel-al → kendi kurye paketi + zamanlanmış sipariş fazlı (Faz 9) | Tek sipariş motoru |
| D54 | Kurye: `courier` rolü şimdi; basit modül Faz 9; canlı takip gelecek kapısı; **modül olarak aktif/pasif** | Kuryesiz işletme zorlanmaz |

### Analitik
| # | Karar | Gerekçe |
|---|---|---|
| D55 | Ayrı **Analitik Merkezi**: widget dashboard + hedefler/anomali uyarıları + **zamanlanmış e-posta/PDF raporları** | Rapor → karar asistanı |
| D56 | Rapor erişimi rol/izin bayraklı; **veri geçmişi sınırsız** + dönem/geçen yıl kıyası | Kurumsal beklenti |

### Yetki & Platform
| # | Karar | Gerekçe |
|---|---|---|
| D57 | İzin sistemi: sabit roller + **tenant ayarlı izin bayrakları** (ikram, iade, raporlar, kasa, masa taşıma...); özel rol oluşturma gelecek | %90 ihtiyaç, sade model |
| D58 | 2FA: TOTP altyapısı; **zorunluluk Süper Admin anahtarında, varsayılan opsiyonel** (öneri: canlıda süper admin için açılması) | Kullanıcı talebi: dayatma yok |
| D59 | Status sayfası + planlı bakım duyuruları + panel banner | Kesinti güveni |
| D60 | Ortamlar: Prod+Staging+PR preview; CI (tip/lint/test/RLS) zorunlu; yedek+PITR+aylık restore tatbikatı (OPERATIONS.md) | Profesyonel işletim |
| D61 | Muhasebe fazlı: CSV/Excel + program uyumlu exportlar erken; doğrudan API adaptörü Faz 10; **ÖKC adaptör kapısı** mimaride | TR satış gerçeği |
| D62 | Tenant API fazlı: API key + imzalı webhooks + read API (Faz 10); yazma API'si pazar yeri altyapısıyla | Entegre edilebilir ürün |

### Ek Modüller
| # | Karar | Gerekçe |
|---|---|---|
| D63 | Plana alındı: **Rezervasyon+bekleme listesi, Kiosk modu, Vardiya planlama+puantaj** (Faz 11) — hepsi modül | 100k$ kapsam |
| D64 | **AÇIK KARAR — Wi-Fi portalı:** kararsız; OTP'li sadakat aynı veriyi topluyor; ileride konuşulacak | Donanım+KVKK yükü |

## Oturum 4 — Açık Kararların Kapatılması (2026-07)

| # | Karar | Gerekçe |
|---|---|---|
| D65 | Destek: **panel içi ticket modülü** (tenant talep → Süper Admin kuyruğu, durum akışı); Yardım Merkezi gelecek kapısı | Talepler tek yerde, ölçülebilir |
| D66 | **REVİZE — SMS sağlayıcısı:** adaptör mimarisi kesin (`lib/integrations/sms`), altyapı Faz 7'de kurulur; somut sağlayıcı seçimi/entegrasyonu artık zorunlu değil, kullanıcı gündeme getirdiğinde yapılır (gerekirse Faz 12 havuzuna kadar ertelenebilir) | Kullanıcı talebi (2026-07-19): OTP/SMS şu an öncelik değil, son iş olarak bakılacak |
| D67 | Geliştirme akışı: **lokal öncelikli** (Docker + Supabase CLI, her şey lokalde görülür/test edilir) → GitHub+CI → canlıya alma **Vercel + Supabase Cloud**; Docker image üretimi baştan (self-hosted paketin temeli) | Kullanıcı talebi: lokalde görme + kontrollü canlıya çıkış |
| D68 | Plan taslağı: **Başlangıç 10 masa/1 şube · Pro 25/2 · Sınırsız ∞/3 dahil** + ek şube ücreti; fiyatlar lansmanda | Dengeli segmentasyon |
| D69 | Wi-Fi portalı **kapsam dışı** (D64 kapandı) | OTP'li sadakat aynı veriyi topluyor; donanım+KVKK yükü |
| D70 | Pazar yeri **karma strateji** (D51 kapandı): aracı katmanla (Posentegra/Entegre App/API Merkezi sınıfı) hızlı çıkış + Yemeksepeti resmî Plugin ve Trendyol partner-bilgisi doğrudan bağlantılarına kademeli geçiş; adaptör deseni geçişi şeffaf kılar | Araştırma bulguları: YS dokümante resmî program, Trendyol self-servise yakın, aracılar oturmuş pazar |
| D71 | **REVİZE — Ürün ismi + domain:** Ürün adı **RKYS Dashboard** olarak belirlendi. Alan adı henüz alınmadı; kullanıcı ileride alacak — müsait değilse başka bir isim seçilip dokümanlar/koddaki referanslar güncellenecek. Subdomain/custom domain mimarisi (D25) zaten hazır, isim değişikliği mimariyi etkilemez | Kullanıcı kararı (2026-07-19) |

## Oturum 5 — Repo Kurulumu (2026-07)

| # | Karar | Gerekçe |
|---|---|---|
| D72 | **Production'a asla erken çıkılmaz:** Proje **lokalde uçtan uca tamamlanmadan** (tüm fazlar bitip kullanıcı onayı alınmadan) hiçbir şekilde Vercel/Supabase Cloud production ortamına deploy yapılmaz; staging dahi kullanıcı onayı ile açılır. Bkz. RULES.md #45 | Kullanıcı açık talimatı (2026-07-19): canlıya çıkış tamamen kullanıcı kontrolünde, aceleye getirilmeyecek |

## Oturum 6 — Test Ritüeli Otomasyonu (2026-07)

| # | Karar | Gerekçe |
|---|---|---|
| D73 | **REVİZE — Faz kapanış testi otomatik:** Manuel el testi ritüeli (TESTING.md §5, eski RULES #43) kaldırıldı. Faz kapanışında eskiden manuel listede yer alacak senaryolar Playwright E2E testine dönüştürülür; Claude Code tam paketi (unit+entegrasyon+E2E) koşturup sonucu sohbette özetler. Gerçek cihaz/görsel kontrol otomatikleştirilemediği için bloklayıcı değildir. **Fazlar arası geçiş yine de her zaman kullanıcı onayına tabidir** — bu değişmedi. Faz içindeki uygulama adımları için ayrıca onay beklenmeyecek (bu gevşetme geçicidir, **Faz 4'te tekrar değerlendirilecek**). | Kullanıcı talebi (2026-07-20): manuel test istemiyorum, otomatik doğrulama yeterli; onay eşiği sadece faz geçişinde kalsın |
| D74 | **EK — Faz kapanışında iki adımlı görünürlük+onay:** D73'ün otomasyonu korunur, ama faz kapanışında Claude Code önce eski manuel-test-listesi formatında okunabilir bir senaryo listesi sunar, ardından açıkça koşum onayı ister ("bunları siz test edebilirsiniz, ya da onay verirseniz sizin yerinize ben yaparım"). Onay sonrası otomatik paket çalışır ve sonucu özetlenir; paket yeşilse **ayrıca** faz geçiş onayı istenir (D73'teki onay adımından bağımsız, ikinci bir onay noktası). | Kullanıcı talebi (2026-07-20): listeyi görmek istiyorum ama test yine otomatik kalsın; "test edebilirsiniz, onay verirseniz ben yaparım" şeklinde ilerlensin |
| D75 | **EK — Adım bazlı otomatik commit+push:** Bir plandaki her numaralı Adım (Faz 1'deki Adım 0-7 gibi) bitip o adımı ilgilendiren hızlı doğrulama (tsc + lint + ilgili unit/entegrasyon testleri) yeşil olunca, Claude Code **onay beklemeden** commit atar ve `origin/main`'e push eder — bu, genel "kullanıcıdan onay almadan commit/push yapma" varsayılanının bu proje için kalıcı istisnasıdır. Commit Kuralları (küçük/odaklı, migration'lar ayrı commit, Conventional Commits) aynen uygulanır; bir Adım içinde migration + kod ikisi de değiştiyse ayrı commit'ler halinde push edilir. Tam paket (integration ×2 + E2E) her Adım'da değil, yalnızca **faz kapanışında** (D73/D74 ritüeli) koşulur — Adım seviyesinde hız önceliklidir. Faz kapanışındaki commit+push zaten D73/D74 akışının parçası, ayrıca onay gerekmez. | Kullanıcı talebi (2026-07-20): "her faz'ın her adımı tamamlandığında commit ve push işini halletsin" — Faz 1 sonuna kadar bu otomatik değildi, yalnızca faz sonunda ayrı onayla yapılıyordu; kullanıcı bunu Adım seviyesine indirmek istedi. Birim="her Adım sonunda" (alt-parçalara bölünmedi), push eşiği="yerel hızlı doğrulama" (tam paket değil) — kullanıcı seçimi. |
| D76 | **REVİZE — D73'ün "faz içi Adım onayı beklenmez" gevşetmesi Faz 4'ten itibaren kaldırıldı:** Faz 4'ten başlayarak bir plandaki her Adım bitip hızlı doğrulaması (ve varsa D75 otomatik commit+push'u) tamamlandıktan sonra, bir sonraki Adım'a geçmeden **önce** kullanıcıya durum özeti sunulur ve açık onay istenir — Faz 1-3'te uygulanan "adımlar arası dur, otomatik devam et" modeli sona erdi. D75'in Adım-sonu otomatik commit+push davranışı bu karardan etkilenmez (tamamlanan Adım yine onaysız commit'lenir); onay yalnızca **bir sonraki Adım'ın uygulamasına başlamadan önce** aranır. D73/D74'ün faz-kapanışı ritüeli (tam paket + iki adımlı görünürlük+onay) değişmeden devam eder. | Kullanıcı talebi (2026-07-21): "faz 4 için adımlar arası bi dur onay al sonra devam et" — D73 zaten bu noktanın Faz 4'te yeniden değerlendirileceğini not etmişti, kullanıcı D75'in Faz 4'ten itibaren tekrar durup onay istenmesini seçti. |
| D77 | **GEÇİCİ — D76'nın adımlar-arası onay gevşetmesi yalnızca Faz 4'ün kalanı için askıya alındı:** Faz 4 Adım 0-3 push edildikten sonra kullanıcı, Faz 4 bitene kadar Adım 4-8'in uygulama adımları arasında durup onay istenmemesini talep etti — D75'in Adım-sonu otomatik commit+push'u aynen sürer, yalnızca "bir sonraki Adım'a geçmeden önce onay" ara adımı Faz 4 tamamlanana kadar kaldırıldı. D73/D74'ün faz-kapanışı ritüeli (senaryo listesi → koşum onayı → tam paket → **ayrı** faz geçiş onayı, Adım 8'de) bundan etkilenmez, aynen uygulanır. Faz 5 başında D76'nın adımlar-arası onay davranışı varsayılan olarak geri döner — kullanıcı aksini söylemedikçe. | Kullanıcı talebi (2026-07-23, Adım 3 sonrası): "senden faz4'ü tamamlayana kadar durmamanı istiyorum. Adımlar arası onay alma commit push işlemlerini yap ama adımları otomatik geç." |
| D78 | **REVİZE — D76 kalıcı olarak kaldırıldı, adımlar arası onay kalıcı olarak sona erdi:** Faz 5 Adım 1 sırasında kullanıcı, D77'deki gibi tek bir faza özgü bir istisna değil, genel ve süresiz bir talimat verdi: bundan böyle **hiçbir fazda** Adım'dan Adım'a geçerken onay beklenmeyecek — Claude Code bir Adım bitip D75'in hızlı doğrulaması+otomatik commit+push'u tamamlanır tamamlanmaz bir sonraki Adım'ın uygulamasına kendiliğinden geçer (Faz 1-3'teki orijinal modele kalıcı dönüş). D73/D74'ün faz-kapanışı ritüeli (senaryo listesi → koşum onayı → tam paket → **ayrı** faz geçiş onayı) bu karardan etkilenmez, değişmeden sürer — kullanıcının talimatı yalnızca "faz adımları" ile sınırlıydı, fazlar arası geçişten bahsetmedi. | Kullanıcı talebi (2026-07-23, Faz 5 Adım 2 başlangıcında): "Faz adımlarında onay almadan devam et." — D77'nin aksine bir faza özgü değil, süresiz ve genel bir talimat. |

## Oturum 7 — Hız Önceliği (2026-07)

| # | Karar | Gerekçe |
|---|---|---|
| D79 | **REVİZE — D73/D74'ün fazlar arası geçiş onayı kalıcı olarak kaldırıldı:** Faz 7 kapanışı sırasında kullanıcı, D78'in adım-seviyesi onay kaldırmasının ötesine geçen genel ve süresiz bir talimat verdi: bundan böyle **fazlar arası geçişte de** onay beklenmeyecek — bir fazın tam test paketi (unit+entegrasyon×2+E2E) yeşil olduğunda Claude Code sonuç özetini sohbette paylaşıp **doğrudan bir sonraki fazın planlama/uygulamasına geçer**. D73/D74'ün geri kalanı (senaryo listesi sunumu, koşum onayı istenmesi, tam paketin koşturulması, sonuç özeti) **değişmeden sürer** — yalnızca en sondaki "ayrı faz geçiş onayı" adımı kaldırıldı. Orta/büyük yeni fazlarda CLAUDE.md'nin "önce plan, sonra kod" ilkesi ve otonom karar eşiği (mimari/kapsam/geri dönüşü zor işlemler için durup sorma) aynen geçerli — bu karar yalnızca "fazı kapat, bir sonrakine geç" onay noktasını kaldırıyor. | Kullanıcı talebi (2026-07-24, Faz 7 kapanışında): "Fazlar arası artık soru sorma projei hızlı bitirmek için fazlarıda onay almadan direk geç." — projeyi hızlı bitirme önceliği, D78'in mantığının fazlar arası geçişe genişletilmesi. |

## Oturum 8 — Faz 4 Revizyonu: Kayıt Onayı + Plan-Modül Yönetimi (2026-07)

| # | Karar | Gerekçe |
|---|---|---|
| D80 | **Kayıt kapalı-kapı onayı + otomatik/manuel ayarı:** `/kayit` formu artık tenant'ı doğrudan `active` açmıyor — `pending_approval` ile açılıyor, `plan_id` seçilen plana atanıyor, ödeme kök domainde (`/kayit/odeme`) alınıyor. `proxy.ts`'in mevcut `tenant_status !== 'active'` kapısı (0002) hiçbir ek mantık yazılmadan bu yeni durumu da (admin/login dahil) otomatik kapatıyor. Onay, platform admin'in elle `approve_tenant`/`reject_tenant` kararına VEYA genel `platform_settings.auto_approve_registrations` ayarına (varsayılan: kapalı/manuel) bağlı — ayar açıksa ödeme onaylanır onaylanmaz (`activate_subscription` içinde) tenant otomatik `active` olur ve planının modülleri açılır. | Kullanıcının fark ettiği güvenlik/monetizasyon açığı: herkes anında tam erişimli hesap açabiliyordu, plan seçtirilmiyordu. |
| D81 | **Plan-modül şablonu + üç kaynaklı modül modeli (plan/paid_addon/granted) + düşürme incelemesi:** `plan_modules` tablosu her planın varsayılan modüllerini tanımlar (Süper Admin `/platform/plans`'tan serbestçe düzenler, `plans.key` artık sabit 3 değere kilitli değil). `tenant_modules.source` bir modülün nereden geldiğini ayırt eder: `plan` (plandan otomatik), `paid_addon` (ayrıca ücretli, düşürmede asla dokunulmaz), `granted` (platform admin elle vermiş veya bir "Talep Et" talebi onaylanmış). Plan değişikliği (platform admin ataması veya tenant'ın kendi ödeyerek yaptığı değişiklik, ikisi de paylaşılan `apply_plan_change` üzerinden) düşürmede plandan kaybolan modülleri hemen silmez — `pending_removal_since` ile işaretler; platform admin `resolve_pending_module_removal` ile Koru (source='granted' olur, kalıcı korunur, bir daha hiç işaretlenmez) veya Kaldır (`is_enabled=false`) kararı verir. Tenant kendi panelinde plan dışı bir modülü `request_module` ile talep edebilir, platform admin `resolve_module_request` ile onaylar/reddeder. **Varsayım:** modül adları için ayrı `platform.modules.<key>` i18n anahtarı açmak yerine mevcut `admin.settings.modules.keys.<key>` çevirileri tekrar kullanıldı (tek kaynak, düşük risk, kolayca revize edilebilir). | Kullanıcının onayladığı model: yükseltmede sorun yok, düşürmede ücreti ödenmiş modül kalıcı korunur; plan dışı modül isteğe bağlı talep akışıyla açılabilir. |
