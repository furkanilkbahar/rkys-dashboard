import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Faz 21 (§2.3) — istatistik kartı: mini alan grafiği + renkli nokta legend +
 * ikonlu footer meta satırı. Mevcut 6 analitik widget'ına oturur.
 *
 * Sparkline saf inline SVG — recharts YÜKLENMEZ. Yeni grafik kütüphanesi de
 * eklenmez (RULES #21); recharts yalnızca gerçek etkileşimli grafiklerde kalır.
 * Bu kart Server Component olarak render edilebilir, sıfır client JS taşır.
 *
 * Panel yüksekliği GÖLGEYLE DEĞİL dolgu açıklığıyla anlatılır; kenarlık soluk.
 */
export type StatTone = "brand" | "ok" | "warn" | "err" | "info";

const TONE_VAR: Record<StatTone, string> = {
  brand: "var(--surface-accent)",
  ok: "var(--sem-ok)",
  warn: "var(--sem-warn)",
  err: "var(--sem-err)",
  info: "var(--sem-info)",
};

/** Değer dizisini 0-100 x 0-24 viewBox'a normalize edip polyline noktası üretir. */
function toPoints(series: readonly number[]): string {
  if (series.length < 2) return "";
  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = max - min || 1;
  const stepX = 100 / (series.length - 1);

  return series
    .map((value, index) => {
      const x = index * stepX;
      // Üstte ve altta 2px nefes payı bırak — çizgi kırpılmasın.
      const y = 22 - ((value - min) / span) * 20;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

export function StatCard({
  label,
  value,
  tone = "brand",
  series,
  footer,
  href,
}: {
  label: ReactNode;
  value: ReactNode;
  tone?: StatTone;
  /** En az 2 nokta; yoksa sparkline hiç çizilmez (uydurma veri yok). */
  series?: readonly number[];
  footer?: ReactNode;
  /**
   * Faz 23: kart tıklanabilir olur ve rakamın DAYANDIĞI rapora gider. Bir
   * istatistiği görüp "peki detayı nerede" diye aramak zorunda kalmak
   * panonun en sık şikâyet edilen yanı; bağlantı yoksa kart yine düz bir
   * kutu olarak kalır (tıklanabilir görünüp hiçbir şey yapmaz olmaz).
   */
  href?: string;
}) {
  const color = TONE_VAR[tone];
  const points = series ? toPoints(series) : "";

  const body = (
    <>
      <p className="flex items-center gap-1.5 text-[10.5px] text-[var(--surface-fg-muted)]">
        <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
        {label}
      </p>

      <p className="mt-1 text-[17px] font-bold tracking-[-0.02em] tabular-nums text-[var(--surface-fg)]">{value}</p>

      {points && (
        <svg
          viewBox="0 0 100 24"
          preserveAspectRatio="none"
          className="mt-1.5 block h-5 w-full"
          aria-hidden="true"
          focusable="false"
        >
          <polyline points={points} fill="none" stroke={color} strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
        </svg>
      )}

      {footer && <p className="mt-1.5 text-[10px] text-[var(--surface-fg-faint)]">{footer}</p>}
    </>
  );

  const base = "block rounded-[var(--radius)] border border-[var(--surface-line)] bg-[var(--surface-panel)] p-2.5 px-3";

  // İki ayrı dönüş: `const Box = href ? Link : "div"` tip düzeyinde çalışmıyor
  // (Link'in `href`'i zorunlu, birleşim `undefined`'ı kabul etmiyor) ve
  // `as any` ile susturmak RULES #9'a aykırı olurdu.
  return href ? (
    <Link
      href={href}
      className={`${base} transition-colors duration-[var(--dur-fast)] hover:border-[var(--surface-line-strong)] hover:bg-[var(--surface-panel-2)]`}
    >
      {body}
    </Link>
  ) : (
    <div className={base}>{body}</div>
  );
}

/** Trend etiketi — yön anlamı renkle taşınır (§2.3 renk ekonomisi). */
export function StatTrend({ direction, children }: { direction: "up" | "down"; children: ReactNode }) {
  return (
    <span
      className="font-semibold"
      style={{ color: direction === "up" ? "var(--sem-ok)" : "var(--sem-err)" }}
    >
      {direction === "up" ? "▲" : "▼"} {children}
    </span>
  );
}
