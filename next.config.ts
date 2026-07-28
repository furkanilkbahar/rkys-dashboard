import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { withSentryConfig } from "@sentry/nextjs";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Dev overlay göstergesi bazı viewport/scroll durumlarında sayfanın
  // üzerine gelip pointer event'leri yakalıyor (Playwright click'lerini
  // engelliyordu) — salt kozmetik, kapatılması güvenli.
  devIndicators: false,
  // Self-hosted Docker imajı (bkz. Dockerfile) minimal bir çalışma zamanı
  // bundle'ı gerektirir — node_modules'ün tamamını taşımak yerine yalnızca
  // kullanılan bağımlılıklar .next/standalone'a kopyalanır. Vercel kendi
  // native-modül paketlemesini yapıyor; ikisi çakışınca sharp'ın libvips
  // .so'su eksik kalıp prod'da ERR_DLOPEN_FAILED veriyordu — bu yüzden
  // standalone yalnızca Dockerfile'ın set ettiği DOCKER_BUILD=true'da açık.
  output: process.env.DOCKER_BUILD === "true" ? "standalone" : undefined,
  // sharp'ın native binary'si Next'in bundling/tracing'inden bağımsız,
  // doğrudan node_modules'tan yüklensin — hem standalone hem Vercel build'i
  // için doğru davranış.
  serverExternalPackages: ["sharp"],
  // sharp platforma özgü native paketi (@img/sharp-linux-x64 vb.) runtime'da
  // dinamik path ile require ediyor — Turbopack'in dosya izleyicisi bunu
  // statik analizle bulamıyor, libvips .so serverless bundle'a hiç
  // kopyalanmıyordu (ERR_DLOPEN_FAILED). Açıkça dahil ediyoruz.
  outputFileTracingIncludes: {
    "/**": ["./node_modules/@img/sharp-libvips-linux-x64/**", "./node_modules/@img/sharp-linux-x64/**"],
  },
};

export default withSentryConfig(withNextIntl(nextConfig), {
  silent: true,
  // DSN boşken Sentry no-op çalışır (sentry.*.config.ts); build-time upload
  // sadece SENTRY_AUTH_TOKEN set edildiğinde (prod pipeline) devreye girer.
  widenClientFileUpload: false,
});
