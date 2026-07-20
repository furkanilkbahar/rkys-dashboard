import { defineConfig, devices } from "@playwright/test";

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
