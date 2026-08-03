import type { Metadata } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
import { cookies, headers } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import "./globals.css";

import { getCurrentTenant } from "@/lib/data/tenant";
import { isSurface, SURFACE_HEADER } from "@/themes/surface";

// Migration 0090 sonrası varsayılan. Kök domainde (marketing/platform) tenant
// yok — o durumda da bir tema anahtarı gerekir, ama orada Katman 1 zaten
// eşleşmez (data-surface="marketing"/"app").
const DEFAULT_THEME_KEY = "gece";

/** Koyu/açık tercihi cookie'de tutulur — localStorage değil. Client'ta
 *  okunsaydı ilk boyamada beyaz flaş olurdu (D88). */
const MODE_COOKIE = "rkys-mode";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Display ailesi (D88). `latin-ext` alt kümesi Türkçe glifleri (ğ ş ı İ ç ö ü)
// kapsar — noktasız ı ve noktalı İ dahil.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin", "latin-ext"],
  axes: ["SOFT", "WONK", "opsz"],
});

export const metadata: Metadata = {
  title: "RKYS Dashboard",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();
  // Kök domainde (marketing/platform) tenant yok — bu durumda varsayılan
  // temaya düşülür; tenant context'i olan admin/menü tarafı kendi seçtiği
  // temayı görür.
  const tenant = await getCurrentTenant();

  // D88: token yüzeyi proxy.ts'te pathname'den türetilip header'a yazılır.
  // Header yoksa (test/edge durumu) uygulama chrome'una düşülür.
  const headerStore = await headers();
  const surfaceHeader = headerStore.get(SURFACE_HEADER);
  const surface = isSurface(surfaceHeader) ? surfaceHeader : "app";

  const cookieStore = await cookies();
  const mode = cookieStore.get(MODE_COOKIE)?.value === "light" ? "light" : "dark";

  return (
    <html
      lang={locale}
      data-surface={surface}
      data-theme={tenant?.themeKey ?? DEFAULT_THEME_KEY}
      data-mode={mode}
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
