import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "server-only": path.resolve(__dirname, "./tests/shims/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    setupFiles: ["./tests/setup/integration-env.ts"],
    // RLS testleri gerçek lokal Supabase'e karşı çalışır; ardışık tenant
    // oluşturma/temizleme çakışmasın diye paralel değil sıralı koşulur.
    fileParallelism: false,
  },
});
