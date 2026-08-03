"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

/**
 * Faz 21 Adım 0 — yatay kategori şeridi (§2.2 kural 3).
 *
 * Kaydırılabilir, aktif durum çok net. Aktif kategori scroll konumundan
 * IntersectionObserver ile türetilir — scroll event dinlenmez (INP bütçesi).
 *
 * NOT: bu bir SEKME ÇUBUĞU DEĞİL. Referanslardaki Home/Map/Search/Profile
 * alt sekme çubuğu bilinçli olarak alınmadı (§2.2 "alınmayacaklar") — RKYS
 * menüsü masaya bağlı, tek işletme, girişsiz bir menüdür.
 */
export function CategoryStrip({ categories }: { categories: { id: string; name: string }[] }) {
  const t = useTranslations("menu.categoryNav");
  const [activeId, setActiveId] = useState<string | null>(categories[0]?.id ?? null);
  const stripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (categories.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActiveId(visible.target.id.replace("kategori-", ""));
      },
      // Üst şeridin altından itibaren say — başlık şeridin arkasına girdiğinde
      // hâlâ "aktif" sayılmasın.
      { rootMargin: "-120px 0px -55% 0px", threshold: 0 },
    );

    for (const category of categories) {
      const el = document.getElementById(`kategori-${category.id}`);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [categories]);

  // Aktif çip görünür alanda kalsın (uzun menülerde şerit kayar).
  useEffect(() => {
    if (!activeId || !stripRef.current) return;
    const chip = stripRef.current.querySelector<HTMLElement>(`[data-category="${activeId}"]`);
    chip?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [activeId]);

  if (categories.length === 0) return null;

  return (
    <nav
      ref={stripRef}
      aria-label={t("label")}
      className="no-scrollbar sticky top-0 z-10 -mx-4 flex gap-2 overflow-x-auto border-b border-[var(--line)] bg-[var(--bg)] px-4 py-2.5 sm:-mx-8 sm:px-8"
    >
      {categories.map((category) => {
        const isActive = category.id === activeId;
        return (
          <a
            key={category.id}
            href={`#kategori-${category.id}`}
            data-category={category.id}
            aria-current={isActive ? "true" : undefined}
            className={[
              "flex min-h-[38px] shrink-0 items-center rounded-full border px-4 text-[13px] whitespace-nowrap no-underline",
              "transition-colors duration-[var(--dur-fast)] ease-[var(--ease-out)]",
              isActive
                ? "border-transparent bg-[var(--accent)] font-semibold text-[var(--accent-fg)]"
                : "border-[var(--line)] bg-[var(--card)] font-medium text-[var(--fg-muted)]",
            ].join(" ")}
          >
            {category.name}
          </a>
        );
      })}
    </nav>
  );
}
