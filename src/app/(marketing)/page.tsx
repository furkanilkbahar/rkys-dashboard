import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { AdminMockup, MenuMockup } from "@/components/marketing/product-mockup";
import { getMarketingPlans } from "@/lib/data/plans";
import { MODULE_KEYS, type ModuleKey } from "@/lib/modules/keys";

/**
 * Faz 21 Adım 2 (§2.4) — pazarlama ana sayfası.
 *
 * Bölüm iskeleti: hero → entegrasyon şeridi → modül vitrini → bölünmüş içerik
 * ×3 → fiyatlandırma → lisans modeli → kapanış CTA. (Nav ve footer layout'ta.)
 *
 * UYDURMA İDDİA YOK (§4, RULES #45): istatistik şeridi, müşteri logosu ve
 * referans/testimonial bölümü sayfada HİÇ yer almıyor — boş state olarak bile
 * değil. Modül sayısı `MODULE_KEYS.length`'ten, fiyatlar `plans`/`plan_modules`
 * tablolarından geliyor; hiçbiri HTML'e gömülü değil.
 *
 * Server Component — sıfır client JS.
 */

const INTEGRATION_NAMES = ["Yemeksepeti", "Getir", "Trendyol", "iyzico", "Logo", "Mikro", "Paraşüt"] as const;

// Modül vitrini 16 kartta gürültüye dönmesin diye anlam gruplarına ayrıldı
// (§2.4: "kart başına farklı pastel tint 15 kartta gürültüye döner; ölçekle").
const MODULE_GROUPS: { key: string; modules: readonly ModuleKey[] }[] = [
  { key: "sales", modules: ["pos_cash", "campaigns", "gift_cards", "crm_loyalty"] },
  { key: "stock", modules: ["inventory", "recipes"] },
  { key: "channels", modules: ["pickup", "delivery", "courier", "marketplace", "kiosk", "reservations"] },
  { key: "ops", modules: ["staff_scheduling", "accounting_export", "api_access", "fiscal_integration"] },
];

const SPLIT_SECTIONS = ["guest", "staff", "owner"] as const;

function formatPriceMinor(priceMinor: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(priceMinor / 100);
}

export default async function MarketingHomePage() {
  const t = await getTranslations("marketing");
  const tModules = await getTranslations("admin.settings.modules.keys");
  const plans = await getMarketingPlans();
  const moduleCount = MODULE_KEYS.length;

  return (
    <main>
      {/* ── 1. HERO ─────────────────────────────────────────────────── */}
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:py-24">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-[var(--surface-tint)] px-3.5 py-1.5 text-[11.5px] font-semibold text-[var(--brand-700)]">
            {t("hero.badge", { count: moduleCount })}
          </span>

          <h1 className="mt-5 font-[family-name:var(--font-display)] text-[clamp(2.4rem,5.5vw,3.4rem)] leading-[1.04] font-semibold tracking-[-0.025em]">
            {t("hero.titleLine1")}
            <br />
            <span className="bg-gradient-to-r from-[var(--brand-600)] to-[var(--brand-300)] bg-clip-text text-transparent">
              {t("hero.titleLine2")}
            </span>
          </h1>

          <p className="mt-5 max-w-[46ch] text-[16px] leading-relaxed text-[var(--surface-fg-muted)]">
            {t("hero.lead")}
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/kayit"
              className="rounded-full bg-[var(--surface-accent)] px-6 py-3.5 text-[14.5px] font-semibold text-[var(--surface-accent-fg)] no-underline"
            >
              {t("hero.cta")}
            </Link>
            <Link
              href="#nasil-calisir"
              className="rounded-full border border-[var(--surface-line)] bg-[var(--surface-panel)] px-6 py-3.5 text-[14.5px] font-semibold text-[var(--surface-fg)] no-underline shadow-[var(--shadow-sm)]"
            >
              {t("hero.secondaryCta")}
            </Link>
          </div>

          <p className="mt-4 text-[12.5px] text-[var(--surface-fg-faint)]">{t("hero.trialNote")}</p>
        </div>

        <div className="relative">
          <AdminMockup />
          <MenuMockup className="absolute -right-2 -bottom-8 w-[136px] sm:w-[150px]" />
        </div>
      </section>

      {/* ── 2. ENTEGRASYON ŞERİDİ ───────────────────────────────────── */}
      <section
        id="entegrasyonlar"
        className="border-y border-[var(--surface-line)] scroll-mt-20"
        aria-labelledby="entegrasyonlar-baslik"
      >
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-3 px-5 py-7">
          {/* §2.4: "Entegrasyonlar" olarak etiketlenir, "müşterilerimiz" olarak DEĞİL. */}
          <div>
            <p className="text-[11px] font-semibold tracking-[0.13em] text-[var(--surface-fg-faint)] uppercase">
              {t("nav.integrations")}
            </p>
            <h2 id="entegrasyonlar-baslik" className="mt-0.5 text-[14px] font-semibold text-[var(--surface-fg)]">
              {t("integrations.title")}
            </h2>
          </div>
          {INTEGRATION_NAMES.map((name) => (
            <span key={name} className="text-[14px] font-semibold text-[var(--surface-fg-muted)] opacity-70">
              {name}
            </span>
          ))}
        </div>
      </section>

      {/* ── 3. MODÜL VİTRİNİ ────────────────────────────────────────── */}
      <section id="moduller" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-16 lg:py-20">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <span className="inline-flex rounded-full bg-[var(--surface-tint)] px-3 py-1.5 text-[11px] font-semibold tracking-[0.1em] text-[var(--brand-700)] uppercase">
              {t("moduleShowcase.eyebrow")}
            </span>
            <h2 className="mt-4 font-[family-name:var(--font-display)] text-[clamp(1.9rem,3.6vw,2.4rem)] leading-tight font-semibold tracking-[-0.02em]">
              {t("moduleShowcase.title")}
            </h2>
            <p className="mt-3 max-w-[42ch] text-[14.5px] leading-relaxed text-[var(--surface-fg-muted)]">
              {t("moduleShowcase.subtitle", { count: moduleCount })}
            </p>
            <Link
              href="#fiyatlandirma"
              className="mt-6 inline-flex rounded-full border border-[var(--surface-line)] bg-[var(--surface-panel)] px-5 py-3 text-[13.5px] font-semibold text-[var(--surface-fg)] no-underline shadow-[var(--shadow-sm)]"
            >
              {t("moduleShowcase.cta")}
            </Link>
          </div>

          <div className="flex flex-col gap-6">
            {MODULE_GROUPS.map((group) => (
              <div key={group.key}>
                <h3 className="text-[11px] font-semibold tracking-[0.12em] text-[var(--surface-fg-faint)] uppercase">
                  {t(`moduleShowcase.groups.${group.key}`)}
                </h3>
                <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
                  {group.modules.map((key) => (
                    <div
                      key={key}
                      className="rounded-[var(--r-lg)] bg-[var(--surface-panel)] p-3.5 shadow-[var(--shadow-sm)]"
                    >
                      <p className="text-[13.5px] font-semibold">{tModules(key)}</p>
                      <p className="mt-1 text-[12.5px] leading-snug text-[var(--surface-fg-muted)]">
                        {t(`moduleShowcase.descriptions.${key}`)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 4. BÖLÜNMÜŞ İÇERİK ×3 ───────────────────────────────────── */}
      <div id="nasil-calisir" className="scroll-mt-20">
        {SPLIT_SECTIONS.map((section, index) => (
          <section
            key={section}
            className={`border-t border-[var(--surface-line)] ${index % 2 === 1 ? "bg-[var(--muted)]" : ""}`}
          >
            <div
              className={`mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 lg:grid-cols-2 ${
                index % 2 === 1 ? "lg:[&>*:first-child]:order-2" : ""
              }`}
            >
              <div>
                <span className="inline-flex rounded-full bg-[var(--surface-tint)] px-3 py-1.5 text-[11px] font-semibold tracking-[0.1em] text-[var(--brand-700)] uppercase">
                  {t(`split.${section}.eyebrow`)}
                </span>
                <h2 className="mt-4 font-[family-name:var(--font-display)] text-[clamp(1.75rem,3.4vw,2.25rem)] leading-tight font-semibold tracking-[-0.02em]">
                  {t(`split.${section}.title`)}
                </h2>
                <ul className="mt-5 flex flex-col gap-3">
                  {(["b1", "b2", "b3", "b4"] as const).map((bullet) => (
                    <li key={bullet} className="flex gap-2.5 text-[14.5px] leading-snug text-[var(--surface-fg-muted)]">
                      <span aria-hidden="true" className="font-bold text-[var(--surface-accent)]">
                        ✓
                      </span>
                      {t(`split.${section}.${bullet}`)}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="relative">
                {section === "guest" ? (
                  <MenuMockup className="mx-auto w-[240px]" />
                ) : (
                  <AdminMockup />
                )}
              </div>
            </div>
          </section>
        ))}
      </div>

      {/* ── 5. FİYATLANDIRMA (gerçek ₺, plans/plan_modules'tan) ─────── */}
      <section
        id="fiyatlandirma"
        className="border-t border-[var(--surface-line)] scroll-mt-20"
        aria-labelledby="fiyat-baslik"
      >
        <div className="mx-auto max-w-6xl px-5 py-16 lg:py-20">
          <h2
            id="fiyat-baslik"
            className="text-center font-[family-name:var(--font-display)] text-[clamp(1.9rem,3.6vw,2.4rem)] font-semibold tracking-[-0.02em]"
          >
            {t("pricing.title")}
          </h2>
          <p className="mx-auto mt-3 max-w-[52ch] text-center text-[14.5px] text-[var(--surface-fg-muted)]">
            {t("pricing.subtitle")}
          </p>

          <div className="mt-10 grid gap-5 sm:grid-cols-3">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className="flex flex-col rounded-[var(--radius)] bg-[var(--surface-panel)] p-6 shadow-[var(--shadow-md)]"
              >
                <p className="text-[15px] font-bold">{plan.name}</p>
                <p className="mt-2 text-[30px] font-bold tracking-[-0.03em] tabular-nums">
                  {formatPriceMinor(plan.priceMinor)}
                  <span className="text-[14px] font-normal text-[var(--surface-fg-muted)]">
                    {t("pricing.perMonth")}
                  </span>
                </p>

                <ul className="mt-5 flex flex-col gap-2 text-[13.5px] text-[var(--surface-fg-muted)]">
                  <li>
                    {plan.tableLimit === null
                      ? t("pricing.unlimitedTables")
                      : t("pricing.tableCount", { count: plan.tableLimit })}
                  </li>
                  <li>{t("pricing.branchCount", { count: plan.includedBranchCount })}</li>
                </ul>

                <div className="mt-4 flex flex-wrap gap-1.5 border-t border-[var(--surface-line)] pt-4">
                  {plan.moduleKeys.map((key) => (
                    <span
                      key={key}
                      className="rounded-full bg-[var(--surface-tint)] px-2.5 py-1 text-[11px] font-medium text-[var(--brand-700)]"
                    >
                      {tModules(key)}
                    </span>
                  ))}
                </div>

                {/* `mt-auto`: modül rozet listeleri farklı uzunlukta olduğu için
                    CTA'lar farklı yüksekliklerde kalıyordu — sarmalayıcı kartın
                    altına itilip üç planda da aynı hizaya geliyor. */}
                <div className="mt-auto pt-6">
                  <Link
                    href="/kayit"
                    className="block rounded-full bg-[var(--surface-accent)] px-5 py-3 text-center text-[13.5px] font-semibold text-[var(--surface-accent-fg)] no-underline"
                  >
                    {t("hero.cta")}
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {/* ── 6. İKİNCİ SATIŞ MODELİ — dipnota gömülmüyor (§2.4) ──── */}
          <div className="mt-8 grid gap-8 rounded-[var(--radius)] border border-[var(--surface-line)] bg-[var(--surface-panel)] p-7 lg:grid-cols-[1.3fr_0.7fr] lg:items-center">
            <div>
              <span className="inline-flex rounded-full bg-[var(--surface-tint)] px-3 py-1.5 text-[11px] font-semibold tracking-[0.1em] text-[var(--brand-700)] uppercase">
                {t("license.eyebrow")}
              </span>
              <h3 className="mt-4 font-[family-name:var(--font-display)] text-[clamp(1.5rem,2.8vw,1.9rem)] leading-tight font-semibold tracking-[-0.02em]">
                {t("license.title")}
              </h3>
              <p className="mt-3 max-w-[60ch] text-[14px] leading-relaxed text-[var(--surface-fg-muted)]">
                {t("license.body")}
              </p>
              <p className="mt-2 text-[12.5px] text-[var(--surface-fg-faint)]">{t("license.note")}</p>
            </div>
            <Link
              href="/iletisim"
              className="justify-self-start rounded-full border border-[var(--surface-line)] px-6 py-3.5 text-[14px] font-semibold text-[var(--surface-fg)] no-underline lg:justify-self-end"
            >
              {t("license.cta")}
            </Link>
          </div>
        </div>
      </section>

      {/* ── 7. KAPANIŞ CTA ──────────────────────────────────────────── */}
      <section className="px-5 pb-20">
        <div className="mx-auto max-w-6xl rounded-[var(--r-2xl)] bg-gradient-to-br from-[var(--brand-700)] to-[var(--brand-500)] px-8 py-14 text-center">
          <h2 className="font-[family-name:var(--font-display)] text-[clamp(1.9rem,4vw,2.6rem)] font-semibold tracking-[-0.02em] text-white">
            {t("closing.title")}
          </h2>
          <p className="mx-auto mt-3 max-w-[46ch] text-[15px] leading-relaxed text-white/80">{t("closing.body")}</p>
          <Link
            href="/kayit"
            className="mt-7 inline-flex rounded-full bg-white px-7 py-3.5 text-[14.5px] font-bold text-[var(--brand-700)] no-underline"
          >
            {t("closing.cta")}
          </Link>
        </div>
      </section>
    </main>
  );
}
