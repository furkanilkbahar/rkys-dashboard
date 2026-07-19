# RKYS Dashboard — Doküman Seti v3.0

QR menüden tam kapsamlı restoran yönetimine **modüler olarak ölçeklenen**, çok kiracılı ve çok şubeli platform.

> Ürün adı: **RKYS Dashboard** (D71). Alan adı henüz alınmadı; ileride alınacak, müsaitliğe göre değişebilir.

## Dokümanlar
| Dosya | İçerik |
|---|---|
| `PRD.md` | Ürün gereksinimleri: ilke, roller, tüm modüller, akışlar |
| `ARCHITECTURE.md` | Mimari: şube katmanı, modül sistemi, veri modeli, adaptörler |
| `PLAN.md` | 12 fazlı yol haritası (checklist) |
| `CLAUDE.md` | Claude Code çalışma talimatları ve kod standartları |
| `RULES.md` | 45 kesin kural ve yasak |
| `TESTING.md` | Test stratejisi, kritik E2E senaryoları, faz kapanış kriterleri |
| `OPERATIONS.md` | Ortamlar, CI, izleme, yedekleme, güvenlik duruşu |
| `DECISIONS.md` | D1–D72 karar günlüğü (bloklayıcı açık karar yok; D66 SMS sağlayıcı seçimi Faz 7'ye ertelendi) |

## Gün 0 — Kurulum Kontrol Listesi (kullanıcı makinesi)
> Claude Code: İlk oturumda bu listeyi kullanıcıyla birlikte doğrula (sürüm komutlarıyla kontrol et). Eksik varsa adım adım yönlendir. **Tüm kutular işaretlendiğinde bu bölümü README'den tamamen sil** — bir daha sorma, dosyada tutma.

- [ ] Node.js LTS kurulu (`node --version`)
- [ ] Git kurulu (`git --version`)
- [ ] Docker Desktop kurulu ve çalışıyor (`docker info`)
- [ ] Claude Code kurulu ve girişli (`claude doctor`)

## Kullanım (Claude Code)
1. Klasörü proje köküne koy (`CLAUDE.md` kökte).
2. Başlangıç: *"CLAUDE.md ve diğer tüm .md dokümanlarını oku. PLAN.md **Faz 0**'dan başla; önce uygulama planını sun, onayımdan sonra kodla."*
3. Faz sonlarında PLAN işaretlenir; mimari değişiklik önce ARCHITECTURE + DECISIONS.

## Ürün Anayasası
**Dinamik Ölçeklenme:** Çekirdek = premium QR menü (`warm-luxury`). Kasa/POS-lite, stok+reçete, CRM+sadakat, kampanya, hediye kartı, gel-al/paket/kurye, pazar yeri, rezervasyon, kiosk, vardiya+puantaj, muhasebe export, tenant API → hepsi tenant'ın aktif/pasif ettiği **modüller**. Kapalı modül hiçbir yüzeyde görünmez.

## Kilit Kararlar (özet)
- Multi-tenant + **çok şubeli** (merkezi menü + şube override; plana dahil şube + ek ücret) · Next.js + Supabase · RLS.
- İki QR tipi, tipsiz garson çağrı, ısrarcı bildirimler, karma iptal, masa taşıma, dayanıklılık paketi.
- Kasa: vardiya + POS-lite + gün sonu; ikram/iade sebep kodlu; kısmi iade Faz 6.
- Hibrit stok (ürün başına basit/reçete) → menü mühendisliği matrisi.
- OTP'li opsiyonel sadakat (damga/puan), kural bazlı kampanya, hediye kartı.
- Analitik Merkezi: widget dashboard + hedef/anomali + zamanlanmış raporlar; sınırsız geçmiş + kıyas.
- 3 plan (masa+şube limitli), 14g kartsız trial, lifetime & self-hosted lisans, private tema.
- İzin bayrakları, opsiyonel 2FA (platform anahtarlı), status sayfası, Prod+Staging+CI (OPERATIONS.md).
- Pazar yeri: karma strateji — aracı katman + kademeli doğrudan bağlantı (D70). Wi-Fi portalı kapsam dışı (D69).
- **Production'a erken çıkış yasak (D72):** proje lokalde uçtan uca bitmeden hiçbir ortam canlıya alınmaz.
