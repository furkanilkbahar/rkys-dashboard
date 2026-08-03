import type { ReactNode } from "react";

/**
 * Faz 21 Adım 3 — operasyon panellerinin ortak kabuğu.
 * `(kitchen)` · `(waiter)` · `(courier)` · `(cashier)`
 *
 * Bu yüzeyler `(admin)`'den FARKLI bir okuma mesafesinde kullanılıyor:
 * mutfak ekranı tezgâhın üstünde, garson tableti elde, kurye telefonu
 * motorda. Adım 3 kabul kriteri "uzaktan okunabilir" bu yüzden tipografiyi
 * admin'e göre bir kademe büyütür ve dokunma hedefini `pointer` türünden
 * bağımsız olarak 44px'e sabitler (`.ops-surface`, globals.css).
 *
 * Katman 2b token'larını (`data-surface="app"`) kullanır — admin'le aynı
 * yüzey ailesi, ayrı bir tema DEĞİL. Renk yalnızca anlam taşıdığında
 * (durum, yaşlanma, bağlantı) kullanılır.
 *
 * Bilinçli olarak `"use client"` değil: çağıranların çoğu client bileşeni
 * ama kabuk saf sunum, hidrasyona ihtiyacı yok.
 */
export function OpsShell({
  title,
  status,
  actions,
  children,
  /** Kanban panosu gibi geniş düzenler tam genişlik ister. */
  width = "wide",
}: {
  title: ReactNode;
  /** Bağlantı göstergesi gibi kalıcı durum öğeleri (sola, başlığın yanına). */
  status?: ReactNode;
  /** İstasyon filtresi, ses açma, çıkış gibi aksiyonlar (sağa yaslı). */
  actions?: ReactNode;
  children: ReactNode;
  width?: "wide" | "narrow";
}) {
  return (
    <div className="ops-surface flex min-h-dvh flex-col bg-[var(--surface-bg)] text-[var(--surface-fg)]">
      <header className="sticky top-0 z-20 border-b border-[var(--surface-line)] bg-[var(--surface-bg)]/95 backdrop-blur">
        <div
          className={`mx-auto flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6 ${
            width === "narrow" ? "max-w-3xl" : "max-w-[1600px]"
          }`}
        >
          <h1 className="text-[22px] font-bold tracking-[-0.02em] text-[var(--surface-fg)]">{title}</h1>
          {status}
          <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>
        </div>
      </header>

      <main
        className={`mx-auto w-full flex-1 px-4 py-4 sm:px-6 sm:py-5 ${
          width === "narrow" ? "max-w-3xl" : "max-w-[1600px]"
        }`}
      >
        {children}
      </main>
    </div>
  );
}

/**
 * İkincil bölüm başlığı — panonun altındaki bağlam blokları için
 * (rezervasyonlar, masa taşıma, kurye ataması). Kolon başlığıyla aynı
 * tipografik ölçek, böylece iki desen aynı ekranda yarışmaz.
 */
export function OpsSection({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <section className="mt-5 flex flex-col gap-2">
      <h2 className="px-0.5 text-[13px] font-semibold tracking-[0.06em] text-[var(--surface-fg-muted)] uppercase">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Bağlam bloklarında kullanılan düz satır (kart değil — kart panoya ait). */
export function OpsRow({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--r-sm)] border border-[var(--surface-line)] bg-[var(--surface-panel)] px-3 py-2">
      {children}
    </div>
  );
}

/**
 * D30 bağlantı göstergesi — dört panelde tek gösterim.
 *
 * Metin sözleşmesi korunur (`connected` / `disconnected` i18n dizeleri).
 * Durum değişimi ANİMASYONLA anlatılır (Faz 21 kabul kriteri 4): nokta renk
 * geçişi yapar ve kopukken nabız atar; `prefers-reduced-motion` altında
 * global kural süreyi sıfırlar, bilgi (renk + metin) kaybolmaz.
 */
export function OpsConnection({
  connected,
  connectedLabel,
  disconnectedLabel,
}: {
  connected: boolean;
  connectedLabel: string;
  disconnectedLabel: string;
}) {
  return (
    <p
      role="status"
      aria-live="polite"
      className="inline-flex items-center gap-2 rounded-[var(--r-pill)] border border-[var(--surface-line)] px-2.5 py-1 text-[12px] font-medium text-[var(--surface-fg-muted)]"
    >
      <span
        aria-hidden="true"
        className={`size-2 shrink-0 rounded-full transition-colors duration-[var(--dur-base)] ease-[var(--ease-out)] ${
          connected ? "" : "ops-pulse"
        }`}
        style={{ backgroundColor: connected ? "var(--sem-ok)" : "var(--sem-err)" }}
      />
      {connected ? connectedLabel : disconnectedLabel}
    </p>
  );
}
