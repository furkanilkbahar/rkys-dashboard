"use client";

import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { PageHeader } from "@/components/admin/page-header";

import { PLATFORM_NAV_ITEMS } from "./nav-items";

/**
 * Faz 21 (§2.3) — platform sayfa başlığı. Admin'le AYNI `PageHeader`
 * bileşenini kullanır; yalnızca eyebrow kaynağı farklı (platform nav grubu).
 * Metin uydurulmaz, gruplama sidebar ile birebir tutarlı kalır.
 */
export function PlatformPageHeader({
  title,
  meta,
  actions,
}: {
  title: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  const t = useTranslations("platform.nav");
  const pathname = usePathname();

  const match = PLATFORM_NAV_ITEMS.filter((item) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`),
  ).sort((a, b) => b.href.length - a.href.length)[0];

  return (
    <PageHeader
      eyebrow={match ? t(`groups.${match.group}`) : undefined}
      title={title}
      meta={meta}
      actions={actions}
    />
  );
}
