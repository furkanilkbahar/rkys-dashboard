import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Faz 23 Adım 2 — Pano yapı taşları. Tamamı Server Component; panoda sıfır
 * client JS var (tek istisna çok satanlar tablosu, o da `DataTable`).
 */

/** Başlık + isteğe bağlı "tümünü gör" bağlantısı taşıyan panel. */
export function DashboardSection({
  title,
  href,
  linkLabel,
  children,
}: {
  title: ReactNode;
  href?: string;
  linkLabel?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[var(--radius)] border border-[var(--surface-line)] bg-[var(--surface-panel)] p-3">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <h2 className="text-[13px] font-semibold text-[var(--surface-fg)]">{title}</h2>
        {href && (
          <Link
            href={href}
            className="shrink-0 text-[11.5px] text-[var(--surface-accent)] hover:underline"
          >
            {linkLabel}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

/**
 * "Şu an" satırı: tek bir canlı sayı + etiketi. Sayı SIFIR olduğunda da
 * çizilir — "0 bekleyen çağrı" gerçek ve rahatlatıcı bir bilgidir, oysa
 * satırın hiç olmaması "ölçmüyoruz" gibi okunur.
 */
export function NowStat({
  label,
  value,
  href,
  tone = "neutral",
}: {
  label: ReactNode;
  value: number;
  href?: string;
  tone?: "neutral" | "ok" | "warn" | "err";
}) {
  const color =
    tone === "ok"
      ? "var(--sem-ok-fg)"
      : tone === "warn"
        ? "var(--sem-warn-fg)"
        : tone === "err"
          ? "var(--sem-err-fg)"
          : "var(--surface-fg)";

  const body = (
    <>
      <span className="text-[19px] font-bold tabular-nums" style={{ color }}>
        {value}
      </span>
      <span className="text-[11.5px] leading-tight text-[var(--surface-fg-muted)]">{label}</span>
    </>
  );

  const className =
    "flex flex-col gap-0.5 rounded-[var(--r-xs)] border border-[var(--surface-line)] px-2.5 py-2";

  return href ? (
    <Link href={href} className={`${className} transition-colors duration-[var(--dur-fast)] hover:bg-[var(--surface-panel-2)]`}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

/**
 * "Dikkat gerektirenler" satırı. Bu liste panonun asıl işlevi: işletmeciye
 * BUGÜN ne yapması gerektiğini söyler. Boşken de bir şey söyler — boş bir
 * dikkat listesi kötü değil, iyi haberdir (`DashboardAllClear`).
 */
export function AttentionItem({
  tone,
  title,
  detail,
  href,
}: {
  tone: "warn" | "err" | "info";
  title: ReactNode;
  detail?: ReactNode;
  href: string;
}) {
  const color = tone === "err" ? "var(--sem-err)" : tone === "warn" ? "var(--sem-warn)" : "var(--sem-info)";

  return (
    <Link
      href={href}
      className="flex items-start gap-2.5 rounded-[var(--r-xs)] px-1.5 py-1.5 transition-colors duration-[var(--dur-fast)] hover:bg-[var(--surface-panel-2)]"
    >
      <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <span className="min-w-0 flex-1">
        <span className="block text-[12.5px] text-[var(--surface-fg)]">{title}</span>
        {detail && <span className="block text-[11.5px] text-[var(--surface-fg-faint)]">{detail}</span>}
      </span>
    </Link>
  );
}

export function DashboardAllClear({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-2 px-1.5 py-3 text-[12.5px] text-[var(--surface-fg-muted)]">
      <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-[var(--sem-ok)]" />
      {children}
    </p>
  );
}

/** Hızlı işlem kutucuğu — en sık gidilen sayfalara tek dokunuş. */
export function QuickLink({ href, label, hint }: { href: string; label: ReactNode; hint?: ReactNode }) {
  return (
    <Link
      href={href}
      className="flex min-h-11 flex-col justify-center rounded-[var(--r-xs)] border border-[var(--surface-line)] px-3 py-2 transition-colors duration-[var(--dur-fast)] hover:border-[var(--surface-line-strong)] hover:bg-[var(--surface-panel-2)]"
    >
      <span className="text-[12.5px] font-medium text-[var(--surface-fg)]">{label}</span>
      {hint && <span className="text-[11px] text-[var(--surface-fg-faint)]">{hint}</span>}
    </Link>
  );
}
