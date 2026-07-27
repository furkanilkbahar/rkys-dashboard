import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("marketing");

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-sm font-semibold">RKYS Dashboard</span>
          <Badge variant="secondary">warm-luxury</Badge>
        </Link>
        <nav className="flex items-center gap-4 text-sm text-muted-foreground">
          <Link href="/sss" className="hover:text-foreground">
            {t("nav.faq")}
          </Link>
          <Link href="/iletisim" className="hover:text-foreground">
            {t("nav.contact")}
          </Link>
          <Link href="/kayit" className="hover:text-foreground">
            {t("nav.register")}
          </Link>
        </nav>
      </header>
      <div className="flex-1">{children}</div>
    </div>
  );
}
