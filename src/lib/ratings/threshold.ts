// PRD §4 / RULES #30: yalnızca 4-5★ Google'a yönlenir, ≤3★ hiçbir koşulda
// yönlendirmez — regresyon riski yüksek olduğu için ayrı, saf bir fonksiyon
// olarak tutulur (bkz. tests/unit/ratings/threshold.test.ts).
//
// Faz 21 / D89: bu fonksiyon `schemas.ts` içindeydi ve misafir menüsündeki
// client bileşeni (rating-prompt.tsx) onu DEĞER olarak import ediyordu —
// schemas.ts'in ilk satırı `import { z } from "zod"` olduğu için zod'un
// tamamı (63 KB gzip) misafirin telefonuna iniyordu. Fonksiyon zod'a hiç
// ihtiyaç duymuyor; bağımlılıksız bu modüle taşındı.
//
// BU DOSYA ZOD (veya başka bir çalışma zamanı bağımlılığı) IMPORT ETMEZ.
// Ettiği anda kaçak geri gelir.
export function shouldRedirectToGoogle(stars: number, googleReviewUrl: string | null): boolean {
  return stars > 3 && Boolean(googleReviewUrl);
}
