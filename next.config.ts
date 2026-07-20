import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { withSentryConfig } from "@sentry/nextjs";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  /* config options here */
};

export default withSentryConfig(withNextIntl(nextConfig), {
  silent: true,
  // DSN boşken Sentry no-op çalışır (sentry.*.config.ts); build-time upload
  // sadece SENTRY_AUTH_TOKEN set edildiğinde (prod pipeline) devreye girer.
  widenClientFileUpload: false,
});
