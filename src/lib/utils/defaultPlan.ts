import type { Plan } from "@/lib/data/plans";

/**
 * Plan seçicilerinin varsayılanı (D101). `plans[0]` YETERSİZDİ: getPlans
 * `table_limit`'e göre sıralar ve Demo planının limiti en küçük olduğu için
 * liste her zaman Demo ile başlıyordu — "Ücretsiz Deneyin"e basan ziyaretçi
 * hiçbir şey seçmeden ₺0'lık iç plana kaydoluyordu (kayıt formu ve
 * /admin/billing seçicisinde aynı hata).
 *
 * Vitrindeki (D96: `is_public`) ilk plan seçilir. Hiç public plan yoksa —
 * yalnızca iç planların tanımlı olduğu bir kurulum — listenin başına düşülür
 * ki seçici hiçbir zaman boş kalmasın.
 *
 * lib/data/plans.ts `server-only`, bu yardımcıyı client seçiciler de
 * çağırıyor; tip import'u tip düzeyinde kaldığı için o sınırı geçmez.
 */
export function defaultSelectablePlanId(plans: Plan[]): string {
  return (plans.find((plan) => plan.isPublic) ?? plans[0])?.id ?? "";
}
