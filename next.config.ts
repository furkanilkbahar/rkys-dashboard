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
  // paketlemesini yapıyor; standalone yalnızca Dockerfile'ın set ettiği
  // DOCKER_BUILD=true'da açık.
  output: process.env.DOCKER_BUILD === "true" ? "standalone" : undefined,
  // wasm-vips'in .wasm dosya referansını bundler statik asset sanıp
  // /_next/static/media/'ya taşıyordu — sunucu (Node) tarafında böyle bir
  // HTTP path dosya sistemi yolu değil, ENOENT ile çöküyordu. External
  // işaretlenince paket kendi __dirname'ine göre doğru yolu buluyor.
  serverExternalPackages: ["wasm-vips"],
  // Ana vips.wasm serverExternalPackages ile doğru yükleniyor ama ek format
  // eklentileri (vips-jxl.wasm vb.) dosya izleyicinin otomatik listesine
  // girmiyor, runtime'da ENOENT ile process çöküyordu — açıkça dahil ediyoruz.
  outputFileTracingIncludes: {
    "/**": ["./node_modules/wasm-vips/lib/*.wasm"],
  },
};

export default withSentryConfig(withNextIntl(nextConfig), {
  silent: true,
  // DSN boşken Sentry no-op çalışır (sentry.*.config.ts); build-time upload
  // sadece SENTRY_AUTH_TOKEN set edildiğinde (prod pipeline) devreye girer.
  widenClientFileUpload: false,
});
