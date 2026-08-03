"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { submitRating } from "@/app/(menu)/masa/rating-actions";
import { Button } from "@/components/ui/button";
import type { RatingWaiterOption } from "@/lib/data/ratings";
import { shouldRedirectToGoogle } from "@/lib/ratings/threshold";
import { createClient } from "@/lib/supabase/client";

// D33/session-panel.tsx ile aynı poll deseni (5sn) — oturum kapanışı
// misafirin JWT claim'ini otomatik değiştirmediği için (bkz. bootstrap.ts
// yorumu), kapanışı algılamanın tek yolu table_sessions.status'ü izlemek.
export function RatingPrompt({
  tableSessionId,
  isEnabled,
  googleReviewUrl,
  waiters,
  alreadyRated,
}: {
  tableSessionId: string;
  isEnabled: boolean;
  googleReviewUrl: string | null;
  waiters: RatingWaiterOption[];
  alreadyRated: boolean;
}) {
  const t = useTranslations("menu.rating");
  const [sessionClosed, setSessionClosed] = useState(false);
  const [dismissed, setDismissed] = useState(alreadyRated);
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [selectedWaiterId, setSelectedWaiterId] = useState<string | null>(null);
  const [staffStars, setStaffStars] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isEnabled || alreadyRated) return;
    const supabase = createClient();

    async function checkStatus() {
      const { data } = await supabase.from("table_sessions").select("status").eq("id", tableSessionId).single();
      if (data?.status === "closed") setSessionClosed(true);
    }

    void checkStatus();
    const pollId = setInterval(() => void checkStatus(), 5000);
    return () => clearInterval(pollId);
  }, [tableSessionId, isEnabled, alreadyRated]);

  if (!isEnabled || dismissed || !sessionClosed) {
    return null;
  }

  async function handleSubmit() {
    if (stars < 1) {
      setError(t("errors.starsRequired"));
      return;
    }
    setSubmitting(true);
    setError(null);
    const result = await submitRating({
      stars,
      comment: comment || undefined,
      ratedStaffId: selectedWaiterId,
      staffStars: selectedWaiterId ? staffStars || null : null,
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(t(`errors.${result.error}`));
      return;
    }
    if (shouldRedirectToGoogle(stars, googleReviewUrl)) {
      window.location.assign(googleReviewUrl!);
      return;
    }
    setDismissed(true);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-md bg-background p-6 shadow-lg">
        <h2 className="text-lg font-semibold">{t("title")}</h2>

        <div className="flex justify-center gap-1" role="radiogroup" aria-label={t("starsLabel")}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              aria-label={t("star", { n })}
              onClick={() => setStars(n)}
              className={`text-3xl ${n <= stars ? "text-yellow-500" : "text-muted-foreground"}`}
            >
              ★
            </button>
          ))}
        </div>

        <textarea
          aria-label={t("commentLabel")}
          placeholder={t("commentPlaceholder")}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="min-h-20 rounded-md border border-input bg-transparent p-2 text-sm"
        />

        {waiters.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">{t("waiterLabel")}</p>
            <div className="flex flex-wrap gap-2">
              {waiters.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => setSelectedWaiterId(w.id === selectedWaiterId ? null : w.id)}
                  className={`rounded-md border px-3 py-2 text-sm ${
                    selectedWaiterId === w.id ? "border-primary" : "border-border"
                  }`}
                >
                  {w.badgeNo ?? t("staffFallback")}
                </button>
              ))}
            </div>
            {selectedWaiterId && (
              <div className="flex justify-center gap-1" role="radiogroup" aria-label={t("staffStarsLabel")}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    aria-label={t("staffStar", { n })}
                    onClick={() => setStaffStars(n)}
                    className={`text-2xl ${n <= staffStars ? "text-yellow-500" : "text-muted-foreground"}`}
                  >
                    ★
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {error && <p className="text-xs text-destructive">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setDismissed(true)}>
            {t("skip")}
          </Button>
          <Button type="button" size="sm" disabled={submitting} onClick={handleSubmit}>
            {submitting ? t("submitting") : t("submit")}
          </Button>
        </div>
      </div>
    </div>
  );
}
