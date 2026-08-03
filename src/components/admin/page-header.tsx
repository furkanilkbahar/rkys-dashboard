import type { ReactNode } from "react";

/**
 * Faz 21 (§2.3) — 33 admin sayfasının TAMAMINDA tek tip sayfa başlığı.
 *
 *   küçük soluk eyebrow etiketi
 *   büyük kalın sayfa başlığı
 *   altında meta/aksiyon satırı (tarih veya kapsam çipi, segmented filtre,
 *   sağa yaslı birincil aksiyonlar)
 *
 * Bilinçli olarak "use client" DEĞİL ve async değil — hem Server Component
 * sayfalarından hem de mevcut `*-manager.tsx` client bileşenlerinden
 * kullanılabilsin diye yalnızca düz prop alır. Metin i18n'den çağıran
 * tarafından geçilir (RULES #11).
 */
export function PageHeader({
  eyebrow,
  title,
  meta,
  actions,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  /** Tarih/kapsam çipi, segmented filtre gibi bağlam öğeleri. */
  meta?: ReactNode;
  /** Sağa yaslanan birincil/ikincil aksiyonlar. */
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col">
      {eyebrow && (
        <p className="text-[10px] font-semibold tracking-[0.14em] text-[var(--surface-fg-faint)] uppercase">
          {eyebrow}
        </p>
      )}
      <h1 className="mt-0.5 text-[20px] font-bold tracking-[-0.02em] text-[var(--surface-fg)]">{title}</h1>

      {(meta || actions) && (
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          {meta}
          {actions && <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
    </header>
  );
}

/** Header meta satırında kullanılan nötr bağlam çipi (tarih, şube, kapsam). */
export function MetaChip({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "ok" }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-[var(--r-xs)] border border-[var(--surface-line)] px-2.5 py-1 text-[11px] text-[var(--surface-fg-muted)]">
      {tone === "ok" && (
        <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-[var(--sem-ok)]" />
      )}
      {children}
    </span>
  );
}
