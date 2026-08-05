/**
 * Duyarlılık denetimi v2 — belge taşması v1'de HİÇBİR sayfada çıkmadı, yani
 * sorun "sayfa sağa kayıyor" değil. Bu koşum üç ayrı kusuru arar:
 *   1. İÇ KAYDIRMA: bir kutunun içeriği kendi genişliğini aşıyor (yatay
 *      kaydırma çubuğu ya da gizlenmiş içerik).
 *   2. KIRPILMA: `overflow:hidden` bir ata, çocuğunun metnini kesiyor.
 *   3. BİNDİRME: iki kardeş öğenin dikdörtgenleri kesişiyor.
 * Ayrıca dokunma hedefi <40px olan etkileşimli öğeleri sayar.
 */
import { chromium } from "@playwright/test";

const BASE = "http://acme.localhost:3000";
const WIDTHS = [390, 768];

// Pazarlama yüzeyi (Faz 23): giriş GEREKTİRMEZ ve kök alan adından servis
// edilir, o yüzden ayrı bir taban adres + ayrı liste. Denetim buraya da
// bakıyor çünkü "ana sayfada taşma var mı" sorusu admin panelininki kadar
// gerçek — ve ziyaretçinin gördüğü ilk ekran orası.
const PUBLIC_BASE = "http://localhost:3000";
const PUBLIC_PATHS = ["/", "/kayit", "/iletisim", "/sss", "/donanim", "/gelistirici", "/blog"];

const PATHS = [
  "/admin", "/admin/menu", "/admin/tables", "/admin/ratings", "/admin/reservations",
  "/admin/campaigns", "/admin/loyalty", "/admin/gift-cards", "/admin/ingredients",
  "/admin/suppliers", "/admin/delivery-zones", "/admin/marketplace", "/admin/kiosk",
  "/admin/api-keys", "/admin/webhooks", "/admin/accounting", "/admin/staff",
  "/admin/scheduling", "/admin/reports", "/analytics", "/admin/support", "/admin/settings",
];

const browser = await chromium.launch();
// `hasTouch` ŞART: dokunma hedefi kurallarının tamamı (`globals.css`'teki
// `@media (pointer: coarse)` blokları) yalnızca kaba işaretçide devreye
// giriyor. Bu bayrak olmadan denetim masaüstü işaretçisiyle ölçüyordu ve
// kural uygulanmadığı için ekranda 40px olan her düğmeyi "28px, çok küçük"
// diye raporluyordu — 390/768 genişliğinde koşan bir denetim için yanlış
// varsayım, ve ürettiği gürültü gerçek kusurları gizliyordu.
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });

await page.goto(`${BASE}/admin/login`);
await page.getByLabel("E-posta").fill("owner@acme.test");
await page.getByLabel("Şifre").fill("password123");
await page.getByRole("button", { name: "Giriş yap" }).click();
await page.waitForURL(/\/admin$/);

const probe = () =>
  page.evaluate(() => {
    const desc = (el) => {
      const cls = typeof el.className === "string" ? el.className : "";
      const txt = (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 46);
      return `${el.tagName.toLowerCase()}${cls ? "." + cls.split(/\s+/).slice(0, 3).join(".") : ""} "${txt}"`;
    };

    const innerScroll = [];
    const clipped = [];
    const small = [];

    // YANLIŞ POZİTİF FİLTRESİ (2026-08-04'te ölçülerek belirlendi):
    // `<Switch>` kökü `after:absolute after:-inset-x-3` ile GÖRÜNMEZ ve
    // BİLİNÇLİ bir dokunma alanı büyütmesi taşıyor. Bu, switch'in ve onu
    // saran hücrenin scrollWidth'ini ~12px şişiriyor ama ekranda hiçbir şey
    // taşmıyor. Filtrelenmezse her switch'li sayfa sahte uyarı üretiyor ve
    // gerçek kırpılmalar bu gürültünün içinde kayboluyor.
    const isSwitchNoise = (el) =>
      el.matches('[data-slot="switch"]') ||
      (el.querySelector('[data-slot="switch"]') !== null && el.scrollWidth - el.clientWidth <= 14);

    for (const el of document.querySelectorAll("main *")) {
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (isSwitchNoise(el)) continue;

      // `<input>` DIŞARIDA: bir metin alanının içeriğinin kutusundan uzun
      // olması tarayıcının normal davranışı (değer kutunun içinde kayar),
      // düzen hatası değil. Ayrıca Base UI Select/Switch form gönderimi için
      // 1px'lik gizli input'lar basıyor; onlar da hep "taşıyor" görünüyordu.
      if (el.tagName === "INPUT") continue;

      if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0) {
        const ox = cs.overflowX;
        innerScroll.push({
          d: desc(el),
          client: el.clientWidth,
          scroll: el.scrollWidth,
          overflowX: ox,
          kind: ox === "hidden" || ox === "clip" ? "GİZLİ" : ox === "visible" ? "TAŞAN" : "kaydırılabilir",
        });
      }

      if (el.children.length === 0 && (el.textContent ?? "").trim() !== "") {
        const parent = el.parentElement;
        if (parent) {
          const pcs = getComputedStyle(parent);
          const pr = parent.getBoundingClientRect();
          if ((pcs.overflowX === "hidden" || pcs.overflowX === "clip") && r.right > pr.right + 1 && pcs.textOverflow !== "ellipsis") {
            clipped.push({ d: desc(el), elRight: Math.round(r.right), parentRight: Math.round(pr.right) });
          }
        }
      }

      // Denetlenen küme, `globals.css`'teki dokunma hedefi kuralının
      // KAPSADIĞI küme ile birebir aynı tutuluyor. Çıplak `a` bilinçli olarak
      // DIŞARIDA: kural da onu listelemiyor ("satır içi metin bağlantıları
      // kapsam dışı — paragraf içinde 44px yükseklik metni bozar"). Denetim
      // kuralı aşan bir küme ararsa, tasarımın bilerek izin verdiği şeyleri
      // kusur diye raporlar ve çıktı "0 = temiz" olma özelliğini kaybeder.
      // Buton gibi davranan bağlantılar `a[data-slot="button"]` ile yakalanır.
      const TARGET_SELECTOR =
        'button, input:not([type=hidden]), select, [role=button], [role=switch], [role=combobox], [role=option], [role=menuitem], [role=tab], a[data-slot="button"]';
      if (el.matches(TARGET_SELECTOR) && r.height < 40) {
        small.push({ d: desc(el), h: Math.round(r.height) });
      }
    }

    const overlaps = [];
    for (const parent of document.querySelectorAll("main, main *")) {
      const kids = [...parent.children].filter((k) => {
        const cs = getComputedStyle(k);
        return cs.display !== "none" && cs.position !== "absolute" && cs.position !== "fixed";
      });
      for (let i = 0; i < kids.length; i++) {
        for (let j = i + 1; j < kids.length; j++) {
          const a = kids[i].getBoundingClientRect();
          const b = kids[j].getBoundingClientRect();
          if (a.width === 0 || b.width === 0 || a.height === 0 || b.height === 0) continue;
          const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
          const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          if (ox > 2 && oy > 2) overlaps.push({ a: desc(kids[i]), b: desc(kids[j]), ox: Math.round(ox), oy: Math.round(oy) });
        }
      }
    }

    return { innerScroll, clipped, small: small.length, smallSample: small.slice(0, 3), overlaps: overlaps.slice(0, 4) };
  });

async function sweep(base, paths) {
  let defects = 0;
  for (const path of paths) {
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 844 });
      try {
        await page.goto(`${base}${path}`, { waitUntil: "networkidle", timeout: 45000 });
      } catch {
        console.log(`\n### ${path} @${width} — YÜKLENEMEDİ`);
        defects++;
        continue;
      }
      const r = await probe();
      if (!r.innerScroll.length && !r.clipped.length && !r.overlaps.length && r.small === 0) continue;
      // `overflow-x: auto` YAZARIN KARARIDIR (kod bloğu, geniş tablo) — kusur
      // sayısına girmez, ama görünür kalsın diye yazdırılır.
      const isDefect =
        r.innerScroll.some((s) => s.kind !== "kaydırılabilir") ||
        r.clipped.length > 0 ||
        r.overlaps.length > 0 ||
        r.small > 0;
      if (isDefect) defects++;
      console.log(`\n### ${path} @${width}`);
      for (const s of r.innerScroll) console.log(`  [${s.kind}] ${s.client}→${s.scroll}px overflow-x:${s.overflowX} · ${s.d}`);
      for (const c of r.clipped) console.log(`  [KIRPIK] ${c.elRight} > ${c.parentRight} · ${c.d}`);
      for (const o of r.overlaps) console.log(`  [BİNDİRME] ${o.ox}×${o.oy}px · ${o.a} ⟂ ${o.b}`);
      if (r.small) console.log(`  [KÜÇÜK HEDEF] ${r.small} adet <40px: ${r.smallSample.map((s) => `${s.d}(${s.h}px)`).join(", ")}`);
    }
  }
  return defects;
}

const publicDefects = await sweep(PUBLIC_BASE, PUBLIC_PATHS);
const adminDefects = await sweep(BASE, PATHS);

console.log(
  `\n=== ÖZET === pazarlama: ${PUBLIC_PATHS.length} sayfa × ${WIDTHS.length} genişlik → ${publicDefects} kusurlu koşum · ` +
    `admin: ${PATHS.length} sayfa × ${WIDTHS.length} genişlik → ${adminDefects} kusurlu koşum`,
);

await browser.close();
