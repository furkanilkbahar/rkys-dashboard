"use client";

import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { ADMIN_NAV_ITEMS } from "./nav-items";
import { PageHeader } from "./page-header";

/**
 * Faz 21 (§2.3) — 33 admin sayfasının ortak başlığı.
 *
 * Eyebrow etiketi UYDURULMAZ: bulunulan sayfanın nav grubundan türetilir
 * (Günlük / Satış & Müşteri / Stok & Maliyet / Kanallar / Entegrasyon /
 * Yönetim). Böylece 20+ yeni i18n dizesi yazmadan her sayfa "neredeyim"
 * bilgisini verir ve sidebar'daki gruplama ile birebir tutarlı kalır.
 *
 * Eşleşen nav maddesi yoksa (alt sayfalar, ör. /admin/menu/[id]/products/[id])
 * en uzun önek eşleşmesi kullanılır; o da yoksa eyebrow hiç çizilmez.
 */
export function AdminPageHeader({
  title,
  meta,
  actions,
}: {
  title: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  const t = useTranslations("admin.nav");
  const pathname = usePathname();

  // En uzun önek kazanır: /admin/menu/x için "/admin/menu" seçilsin, "/admin" değil.
  const match = ADMIN_NAV_ITEMS.filter((item) =>
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
