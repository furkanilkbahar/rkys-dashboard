import type { ReactNode } from "react";

/** Anlam tonları — renk YALNIZCA durum/aciliyet taşıdığında (§2.3). */
export type OpsTone = "neutral" | "ok" | "warn" | "err" | "accent";

const TONE_COLOR: Record<OpsTone, string> = {
  neutral: "var(--surface-fg-faint)",
  ok: "var(--sem-ok)",
  warn: "var(--sem-warn)",
  err: "var(--sem-err)",
  accent: "var(--surface-accent)",
};

/**
 * Faz 21 Adım 3 — kanban panosu (PLAN.md: "kanban deseni KDS istasyon
 * panosuna ve sipariş durum makinesine uygulanır").
 *
 * Kolonlar sipariş durum makinesinin adımlarıdır; bir fiş her zaman tek bir
 * kolonda durur ve ilerledikçe sağa geçer. Düz kart ızgarasından farkı:
 * mutfaktaki kişi "ne hazırlanıyor / ne bekliyor / ne hazır" sorusunu
 * kartları okumadan, kolon yüksekliğinden yanıtlayabilir.
 *
 * Dar ekranda (telefon) kolonlar alt alta yığılır — pano yatay kaydırmaya
 * zorlanmaz; tablet ve üstünde yan yana.
 */
// Tailwind sınıfları statik yazılır (JIT tarayıcısı şablon dizesi üretemez).
const BOARD_COLUMNS: Record<2 | 3 | 4, string> = {
  2: "md:grid-cols-2",
  3: "md:grid-cols-3",
  4: "md:grid-cols-2 xl:grid-cols-4",
};

export function OpsBoard({ children, columns }: { children: ReactNode; columns: 2 | 3 | 4 }) {
  return <div className={`grid items-start gap-3 lg:gap-4 ${BOARD_COLUMNS[columns]}`}>{children}</div>;
}

/**
 * Pano kolonu: kalın düz başlık + sayaç, altında kartlar.
 *
 * Başlık uzaktan okunur (14px semibold uppercase + 20px sayaç); kolon
 * gövdesi çökük yüzeyde (`--surface-sunken`) durur, böylece kart ile kolon
 * arasındaki fark gölge olmadan da anlaşılır (Katman 2b: yükseklik dolgu ve
 * yüzey tonuyla anlatılır, gölgeyle değil).
 */
export function OpsColumn({
  label,
  count,
  tone = "neutral",
  emptyLabel,
  children,
}: {
  label: ReactNode;
  count: number;
  tone?: OpsTone;
  emptyLabel: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex min-w-0 flex-col rounded-[var(--r-md)] bg-[var(--surface-sunken)] p-2.5">
      {/* Başlık YAPIŞKAN: yoğun bir serviste kolonda onlarca fiş birikiyor,
          sayfa kaydırılınca "hangi kolona bakıyorum" bilgisi kaybolmamalı.
          Ofset, üstteki yapışkan panel başlığının yüksekliği kadar
          (`--ops-header-h`, globals.css). */}
      <header className="sticky top-[var(--ops-header-h)] z-10 -mx-2.5 -mt-2.5 mb-2.5 flex items-center gap-2 rounded-t-[var(--r-md)] bg-[var(--surface-sunken)] px-4 pt-3 pb-2.5">
        <span
          aria-hidden="true"
          className="size-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: TONE_COLOR[tone] }}
        />
        <h2 className="text-[13px] font-semibold tracking-[0.06em] text-[var(--surface-fg-muted)] uppercase">
          {label}
        </h2>
        <span className="ml-auto text-[20px] font-bold tabular-nums text-[var(--surface-fg)]">{count}</span>
      </header>

      <div className="flex flex-col gap-2.5">
        {count === 0 ? (
          <p className="rounded-[var(--r-sm)] border border-dashed border-[var(--surface-line)] px-3 py-6 text-center text-[13px] text-[var(--surface-fg-faint)]">
            {emptyLabel}
          </p>
        ) : (
          children
        )}
      </div>
    </section>
  );
}

/**
 * Operasyon kartı — fiş / çağrı / teslimat.
 *
 * `data-slot="card"` KORUNUR: `waiter-call-realtime.spec.ts` ve
 * `courier-assignment.spec.ts` kartları bu seçiciyle buluyor (§5 davranış
 * sözleşmesi).
 *
 * `tone` sol kenarda ince bir şerit olarak görünür — aciliyet kartın
 * tamamını boyamadan, uzaktan taranabilir şekilde anlatılır.
 */
export function OpsCard({
  tone = "neutral",
  children,
}: {
  tone?: OpsTone;
  children: ReactNode;
}) {
  return (
    <article
      data-slot="card"
      className="flex flex-col overflow-hidden rounded-[var(--r-sm)] border border-[var(--surface-line)] bg-[var(--surface-panel)]"
      style={
        tone === "neutral"
          ? undefined
          : { borderInlineStartWidth: 3, borderInlineStartColor: TONE_COLOR[tone] }
      }
    >
      {children}
    </article>
  );
}

/** Kart üstü durum/meta rozeti. Sayısal değerler `tabular-nums`. */
export function OpsBadge({ tone = "neutral", children }: { tone?: OpsTone; children: ReactNode }) {
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 rounded-[var(--r-xs)] px-1.5 py-0.5 text-[12px] font-semibold tabular-nums"
      style={{
        color: tone === "neutral" ? "var(--surface-fg-muted)" : TONE_COLOR[tone],
        backgroundColor: tone === "neutral" ? "var(--surface-panel-2)" : "color-mix(in oklab, currentColor 14%, transparent)",
      }}
    >
      {children}
    </span>
  );
}
