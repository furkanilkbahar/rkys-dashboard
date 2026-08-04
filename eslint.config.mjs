import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Bundled Claude Code tooling — not project source.
    ".claude/**",
    // Vercel CLI build output (.gitignore'da var ama eslint'in varsayılan
    // listesinde yok) — minified bundle'lar `pnpm lint`'i binlerce sahte
    // uyarıyla kırıyordu.
    ".vercel/**",
    // Supabase CLI'ın ürettiği geçici dosyalar (.gitignore'da var ama
    // eslint'in varsayılan listesinde yok). `supabase start` edge runtime
    // için minified bir bootstrap yazıyor ve o dosya tek başına 150+ sahte
    // hata üretiyordu.
    "supabase/.temp/**",
    // Edge function'lar Deno runtime'ında koşuyor — Node/Next kurallarıyla
    // denetlenmeleri anlamsız (tsconfig'te de exclude edildiler).
    "supabase/functions/**",
  ]),
]);

export default eslintConfig;
