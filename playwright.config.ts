import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";

// tests/helpers/testClients.ts (Adım 7'den itibaren bazı E2E testlerinde de
// kullanılıyor — bkz. onboarding.spec.ts) modül yüklenirken process.env'i
// okuyor; vitest.integration.config.ts'teki setup dosyasıyla aynı desen.
config({ path: ".env.local" });

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  // Realtime (WebSocket) senaryoları tek dev sunucusuna karşı yüksek
  // paralellikte (5 worker) ara sıra zaman aşımına uğrayabiliyor — izole
  // çalıştırıldıklarında güvenilir şekilde geçiyorlar (kod hatası değil,
  // eşzamanlılık altında sunucu gecikmesi). 1 retry bu sınıf kırılganlığı emer.
  retries: 2,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  // Paket acme'nin gerçek demo verisine yazıyor ve spec'lerin çoğu
  // bıraktığını toplamıyordu; artıklar hem demo kalitesini hem başka
  // spec'leri bozuyordu (ölçüm ve gerekçe: tests/e2e/global-teardown.ts).
  globalTeardown: "./tests/e2e/global-teardown.ts",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 60_000,
  },
  projects: [
    {
      name: "chromium-desktop",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-safari",
      use: { ...devices["iPhone 14"] },
    },
  ],
});
