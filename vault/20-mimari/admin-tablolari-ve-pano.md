---
tags: [mimari, admin, frontend]
ozet: "Admin panelinin tablo primitifi (DataTable), duyarlilik modeli ve Pano'nun veri kurallari — Faz 23."
guncelleme: 2026-08-04
---

# Admin tablolari ve Pano

Karar kaydi: [[DECISIONS]] D91 (DataTable), D92 (Pano), D93 (E2E teardown).
Gorsel dil: kokteki `DESIGN.md`. Faz kaydi: [[PLAN]] Faz 23.

## Duyarlilik modeli — tek DOM, iki duzen

`src/components/admin/data-table.tsx` **yalnizca `<table>` render eder**.
`sm` altinda `globals.css`'teki `.data-table` blogu ayni isaretlemeyi etiketli
karta cevirir (`td::before { content: attr(data-label) }`).

Ikinci bir mobil isaretleme YAZILMAZ: ayni `data-testid` iki kez basilir ve
Playwright strict-mode ihlali uretir.

Hucre rolleri `td` uzerindeki oznitelikle belirlenir:
- `data-primary` → kart modunda satirin basligi (etiketsiz, kalin)
- `data-actions` → etiketsiz, tam genislik, butonlar sarar
- `data-label` → kart modunda hucrenin onune yazilan etiket

Satir alti acilan paneller `expandedRow` ile ayri bir `<tr data-expansion>`'da
yasar; kart modunda `:has(+ tr[data-expansion])` ile ustteki karta yapisir
(CSS'te "onceki kardes" secilemedigi icin tek yol budur).

## Tablo sıralamasinda kalici kural

**Her zaman ham deger ile sirala** (`value` alani): kurus tam sayisi, ISO
tarih, dakika, oran. Bicimlenmis metni siralamak sessiz yanlislar uretir —
"₺90 > ₺1.200,00", "15.01.2027 < 03.02.2026". Kolon `value` vermezse
siralanamaz ve aramaya katilmaz (uydurma bir siralama yanlis bilgidir).

## Dokunma hedefleri

`.admin-surface` kaba isaretcide (`pointer: coarse`) hedefleri ≥40px'e
sabitler. Masaustu yogunlugu DEGISMEZ — `DESIGN.md`'nin bilincli tercihi.
Operasyon panellerindeki `.ops-surface` ise isaretciden BAGIMSIZ 44px kullanir
(duvara asili KDS fareyle de kullaniliyor, bkz. [[garson-mutfak-panelleri]]).

## Tabloya alinmayanlar (bilincli)

| Sayfa | Neden |
|---|---|
| `settings` | Form, liste degil |
| `menu` | Surukle-birak sirali liste; tablo dnd ile kavga eder |
| Personel **uye** listesi | `profiles`'ta ad/e-posta kolonu yok — tablonun kimlik kolonu olamaz. Cihaz listesi tabloya alindi, uye duzenleyicileri form kaldi. **Acik gap:** uyeler yalnizca rol+rozetle ayirt ediliyor. |

## Pano'nun veri kurallari

`/admin` dort soruyu cevaplar: bugun nasil gidiyor · su anda ne oluyor · neye
bakmam gerekiyor · sik yaptigim isler nerede. Her KPI karti rakamin
DAYANDIGI rapora tarih parametresiyle gider.

**Uydurma yasagi uc somut kurala indi:**
1. Kapanmis gun yoksa sparkline **hic cizilmez** (sifirla doldurulmaz).
2. `reports.revenue` izni yoksa ciro/ortalama sepet/cok satanlar hic render
   edilmez (RULES #41).
3. Kapali modulun bolumu hic cizilmez (RULES #34) — stok, rezervasyon.

**Iki tuzak (olcumle bulundu):**
- `get_period_revenue_report` yalnizca `daily_sales_summary`yi okur, oraya da
  yalnizca **kapatilmis** gunler girer → bugunun siparis sayisi icin
  kullanilamaz (kasada siparis varken "0" yazardi). `getTodayOrderCount` son
  48 saati cekip her satiri tenant saat diliminde bicimlendirir.
- Ortalama sepetin paydasi "acik siparis" olamaz: servis edilen siparisler
  paydadan duserken ciro dusmedigi icin rakam gun ilerledikce siserdi.

Seed'de acme icin **14 gunluk kapanmis gun gecmisi** var (`current_date`e
goreli, `db reset` sonrasi taze kalir). **Bugun asla kapatilmaz** —
`is_business_date_closed` bugune bakar; kapatmak "Gunu Kapat"i gizler ve o
gune odeme kabulunu durdururdu.

## Olcum araci

`node scripts/responsive-audit.mjs` — 22 admin sayfasini 390/768px'te acar,
ic kaydirma / kirpilma / bindirme / kucuk dokunma hedefi arar. Iki yanlis
pozitif filtrelidir (ikisi de olculerek dogrulandi): `<Switch>` kokundeki
gorunmez `after:-inset-x-3` dokunma alani buyutmesi, ve bir `<input>`'un
degerinin kutusundan uzun olmasi (tarayicinin normal davranisi).

Faz 23 kapanisinda: **0 kirpilma / 0 tasma / 0 bindirme**.
