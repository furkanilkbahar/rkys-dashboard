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
  // kullanılan bağımlılıklar .next/standalone'a kopyalanır.
  output: "standalone",
  // standalone'ın dosya-izleme adımı sharp'ın native libvips .so'sunu
  // kopyalamıyor (bilinen Next.js+sharp+standalone sorunu, prod'da
  // ERR_DLOPEN_FAILED ile çöküyordu) — bu paket tracing'den hariç tutulup
  // runtime'da doğrudan node_modules'tan yükleniyor.
  serverExternalPackages: ["sharp"],
};

export default withSentryConfig(withNextIntl(nextConfig), {
  silent: true,
  // DSN boşken Sentry no-op çalışır (sentry.*.config.ts); build-time upload
  // sadece SENTRY_AUTH_TOKEN set edildiğinde (prod pipeline) devreye girer.
  widenClientFileUpload: false,
});
