import Link from "next/link";
import { getTranslations } from "next-intl/server";

/**
 * Faz 21 Adım 2 (§2.4) — pazarlama chrome'u.
 *
 * Nav: logo solda, orta menü, sağda ikincil "Giriş" + dolu birincil CTA. Sticky.
 * Footer: logo + tanım, 4 link kolonu, alt bar (Şartlar / Gizlilik / KVKK).
 *
 * BÜLTEN FORMU YOK: §2.4 iskeletinde geçiyor ama arkasında çalışan bir abonelik
 * ucu yok — çalışmayan bir form, olmayan bir formdan kötüdür. Yerine gerçek
 * olan konuldu: iletişim/demo bağlantısı.
 *
 * Katman 2a token'ları (`[data-surface="marketing"]`) `<html>`'den geliyor;
 * bu ağaçta ayrıca tema sarmalayıcısı yok.
 */
export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("marketing");

  const navLinks = [
    { href: "/#moduller", label: t("nav.modules") },
    { href: "/#fiyatlandirma", label: t("nav.pricing") },
    { href: "/#entegrasyonlar", label: t("nav.integrations") },
    { href: "/gelistirici", label: t("nav.developers") },
  ];

  const footerColumns = [
    {
      title: t("footer.product"),
      links: [
        { href: "/#moduller", label: t("nav.modules") },
        { href: "/#fiyatlandirma", label: t("nav.pricing") },
        { href: "/donanim", label: t("footer.hardware") },
        { href: "/status", label: "Status" },
      ],
    },
    {
      title: t("footer.company"),
      links: [
        { href: "/iletisim", label: t("nav.contact") },
        { href: "/kayit", label: t("nav.register") },
      ],
    },
    {
      title: t("footer.resources"),
      links: [
        { href: "/sss", label: t("nav.faq") },
        { href: "/blog", label: t("footer.blog") },
        { href: "/gelistirici", label: t("footer.developers") },
      ],
    },
    {
      title: t("footer.legal"),
      links: [
        { href: "/legal/kvkk", label: t("footer.kvkk") },
        { href: "/legal/cerez", label: t("footer.cerez") },
        { href: "/legal/sozlesme", label: t("footer.sozlesme") },
        { href: "/legal/veri-silme", label: t("footer.veriSilme") },
      ],
    },
  ];

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--surface-bg)] text-[var(--surface-fg)]">
      <header className="sticky top-0 z-30 border-b border-[var(--surface-line)] bg-[var(--surface-bg)]/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-5 py-3.5">
          <Link href="/" className="flex shrink-0 items-center gap-2 no-underline">
            <span aria-hidden="true" className="size-5 rounded-[6px] bg-[var(--surface-accent)]" />
            <span className="text-[15px] font-bold text-[var(--surface-fg)]">RKYS Dashboard</span>
          </Link>

          <nav aria-label={t("nav.modules")} className="hidden items-center gap-5 md:flex">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-[13.5px] text-[var(--surface-fg-muted)] no-underline transition-colors duration-[var(--dur-fast)] hover:text-[var(--surface-fg)]"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/admin/login"
              className="rounded-full px-3 py-2 text-[13px] text-[var(--surface-fg-muted)] no-underline hover:text-[var(--surface-fg)]"
            >
              {t("nav.login")}
            </Link>
            <Link
              href="/kayit"
              className="rounded-full bg-[var(--surface-accent)] px-4 py-2 text-[13px] font-semibold text-[var(--surface-accent-fg)] no-underline"
            >
              {t("hero.cta")}
            </Link>
          </div>
        </div>
      </header>

      <div className="flex-1">{children}</div>

      <footer className="border-t border-[var(--surface-line)]">
        <div className="mx-auto max-w-6xl px-5 py-12">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-[1.6fr_repeat(4,1fr)]">
            <div>
              <div className="flex items-center gap-2">
                <span aria-hidden="true" className="size-5 rounded-[6px] bg-[var(--surface-accent)]" />
                <span className="text-[15px] font-bold">RKYS Dashboard</span>
              </div>
              <p className="mt-3 max-w-[38ch] text-[13px] leading-relaxed text-[var(--surface-fg-muted)]">
                {t("footer.tagline")}
              </p>
            </div>

            {footerColumns.map((column) => (
              <div key={column.title}>
                <h2 className="text-[11px] font-semibold tracking-[0.12em] text-[var(--surface-fg-faint)] uppercase">
                  {column.title}
                </h2>
                <ul className="mt-3 flex flex-col gap-2">
                  {column.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="text-[13px] text-[var(--surface-fg-muted)] no-underline hover:text-[var(--surface-fg)]"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-10 border-t border-[var(--surface-line)] pt-5 text-[12px] text-[var(--surface-fg-faint)]">
            © {new Date().getFullYear()} RKYS Dashboard — {t("footer.rights")}
          </div>
        </div>
      </footer>
    </div>
  );
}
