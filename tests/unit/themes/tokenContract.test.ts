import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { resolveSurface } from "@/themes/surface";

/**
 * Faz 21 / D88 — token sözleşmesi.
 *
 * Üç şeyi birden korur:
 *  1. Üç tenant teması AYNI token setini tanımlar (eksik token = kırmızı test,
 *     spec'in "eksik token derleme/lint hatası versin" maddesi).
 *  2. Tenant temaları YALNIZCA [data-surface="guest"] altında yazar —
 *     admin/pazarlama yüzeyine sızamazlar.
 *  3. Yüzey katmanları tenant token'ı tanımlamaz (ters yönde sızıntı).
 */

const THEME_DIR = path.resolve(__dirname, "../../../src/themes");
const TENANT_THEMES = ["gece", "kagit", "kor"] as const;

function readTheme(name: string): string {
  return readFileSync(path.join(THEME_DIR, "tenant", `${name}.css`), "utf8");
}

function declaredTokens(css: string): Set<string> {
  const tokens = new Set<string>();
  for (const match of css.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gim)) {
    tokens.add(match[1]);
  }
  return tokens;
}

/** CSS yorumlarını ayıklar — seçici ayrıştırması yorum bloklarını yutmasın. */
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

/** Dosyadaki tüm kural seçicilerini döner (at-rule'lar hariç). */
function selectors(css: string): string[] {
  return [...stripComments(css).matchAll(/(^|\})\s*([^{}@]+?)\s*\{/g)]
    .map((m) => m[2].trim())
    .filter((selector) => selector.length > 0 && !selector.startsWith("@"));
}

describe("tenant tema token sözleşmesi", () => {
  const sets = new Map(TENANT_THEMES.map((name) => [name, declaredTokens(readTheme(name))]));

  it("üç tema da aynı token setini tanımlar", () => {
    const [reference, ...rest] = TENANT_THEMES;
    const referenceSet = sets.get(reference)!;

    for (const name of rest) {
      const current = sets.get(name)!;
      const missing = [...referenceSet].filter((t) => !current.has(t));
      const extra = [...current].filter((t) => !referenceSet.has(t));

      expect(missing, `${name}.css eksik token: ${missing.join(", ")}`).toEqual([]);
      expect(extra, `${name}.css fazladan token: ${extra.join(", ")}`).toEqual([]);
    }
  });

  it("her tema görselsiz fallback için kendi --placeholder token'ını tanımlar", () => {
    // Tasarım incelemesi P0: --card-2'den türetilen placeholder açık temada
    // neredeyse görünmezdi. Her tema kendi değerini vermek zorunda.
    for (const name of TENANT_THEMES) {
      expect(sets.get(name)!.has("--placeholder"), `${name}.css --placeholder tanımlamıyor`).toBe(true);
      expect(sets.get(name)!.has("--placeholder-fg"), `${name}.css --placeholder-fg tanımlamıyor`).toBe(true);
    }
  });

  it("tenant temaları yalnızca [data-surface=\"guest\"] altında yazar", () => {
    for (const name of TENANT_THEMES) {
      for (const selector of selectors(readTheme(name))) {
        expect(
          selector.startsWith('[data-surface="guest"]'),
          `${name}.css yüzey dışına yazıyor: ${selector}`,
        ).toBe(true);
      }
    }
  });
});

describe("yüzey seçicileri :root güvenlik ağını yenmeli", () => {
  // REGRESYON: `globals.css`'teki `:root` fallback bloğu (0,1,0) @import'lardan
  // SONRA geliyor. Yüzey blokları düz `[data-surface="app"]` (0,1,0) ile
  // yazılırsa özgüllük berabere kalır ve kaynak sırasıyla fallback KAZANIR —
  // admin panelinde koyu zemin üstünde beyaz kartlar olarak ortaya çıkmıştı.
  // `html` öneki özgüllüğü (0,1,1)'e çıkarıp bunu kesin çözer.
  it.each(["surface-app", "surface-marketing"])("%s.css seçicileri html öneki taşır", (file) => {
    const css = readFileSync(path.join(THEME_DIR, "tokens", `${file}.css`), "utf8");
    const blocks = selectors(css).filter((selector) => selector.includes("data-surface"));

    expect(blocks.length).toBeGreaterThan(0);
    for (const selector of blocks) {
      expect(selector.startsWith("html["), `${file}.css: "${selector}" html öneki taşımıyor`).toBe(true);
    }
  });

  it("tenant tema seçicileri iki öznitelikli olduğu için zaten fallback'i yener", () => {
    for (const name of TENANT_THEMES) {
      for (const selector of selectors(readTheme(name))) {
        const attributeCount = (selector.match(/\[/g) ?? []).length;
        expect(attributeCount, `${name}.css: "${selector}" tek öznitelikli`).toBeGreaterThanOrEqual(2);
      }
    }
  });
});

describe("yüzey katmanları tenant token'ı tanımlamaz", () => {
  // Ters yönde sızıntı: RKYS ürün token'ı misafir menüsüne kaçmasın.
  const TENANT_ONLY = ["--placeholder", "--placeholder-fg", "--t-display", "--t-price-w", "--radius-img"];

  it.each(["surface-app", "surface-marketing"])("%s.css tenant token'ı içermez", (file) => {
    const css = readFileSync(path.join(THEME_DIR, "tokens", `${file}.css`), "utf8");
    const declared = declaredTokens(css);
    const leaked = TENANT_ONLY.filter((token) => declared.has(token));
    expect(leaked, `${file}.css tenant token'ı sızdırıyor: ${leaked.join(", ")}`).toEqual([]);
  });
});

describe("resolveSurface", () => {
  it("misafir menüsü yollarını guest'e çözer", () => {
    for (const pathname of ["/masa", "/masa/secim", "/paket", "/teslimat", "/rezervasyon", "/kiosk/ABC123"]) {
      expect(resolveSurface(pathname, false)).toBe("guest");
    }
  });

  it("tenant subdomain'indeki personel yüzeylerini app'e çözer", () => {
    for (const pathname of ["/admin", "/admin/menu", "/waiter", "/kitchen", "/cashier", "/courier", "/vardiya"]) {
      expect(resolveSurface(pathname, false)).toBe("app");
    }
  });

  it("kök domainde /platform app, geri kalanı marketing", () => {
    expect(resolveSurface("/platform", true)).toBe("app");
    expect(resolveSurface("/platform/tenants/x", true)).toBe("app");
    expect(resolveSurface("/", true)).toBe("marketing");
    expect(resolveSurface("/sss", true)).toBe("marketing");
    expect(resolveSurface("/kayit", true)).toBe("marketing");
  });

  it("önek eşleşmesi sınır tanır — /masalar guest değildir", () => {
    expect(resolveSurface("/masalar", false)).toBe("app");
    expect(resolveSurface("/platformlar", true)).toBe("marketing");
  });
});
