"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { advanceCourierAssignment, updateCourierLocation } from "@/app/(waiter)/waiter/courier-actions";
import { OpsBadge, OpsCard } from "@/components/ops/ops-board";
import { OpsShell } from "@/components/ops/ops-shell";
import { Button } from "@/components/ui/button";
import type { CourierAssignmentView } from "@/lib/data/courier";
import { formatPrice } from "@/lib/utils/currency";

// Faz 16 Adım 1 (S66): kurye kendi konumunu, teslimatı fiilen taşırken sık
// sık göndersin diye watchPosition'a bağlı, saniye başına en fazla bir
// gönderim yapan basit bir throttle — sunucuya gereksiz RPC baskısı yapmaz.
const LOCATION_UPDATE_MIN_INTERVAL_MS = 15_000;

const NEXT_STATUS: Record<CourierAssignmentView["status"], "en_route" | "delivered" | null> = {
  assigned: "en_route",
  en_route: "delivered",
  delivered: null,
};

export function CourierPanel({
  initialAssignments,
  currency,
}: {
  initialAssignments: CourierAssignmentView[];
  currency: string;
}) {
  const t = useTranslations("courier");
  const [assignments, setAssignments] = useState(initialAssignments);
  const [sharingLocation, setSharingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const lastSentAtRef = useRef(0);

  function handleToggleLocationSharing() {
    if (sharingLocation) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setSharingLocation(false);
      return;
    }

    if (!("geolocation" in navigator)) {
      setLocationError(t("locationSharing.unsupported"));
      return;
    }

    setLocationError(null);
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const now = Date.now();
        if (now - lastSentAtRef.current < LOCATION_UPDATE_MIN_INTERVAL_MS) return;
        lastSentAtRef.current = now;
        void updateCourierLocation(position.coords.latitude, position.coords.longitude);
      },
      () => setLocationError(t("locationSharing.denied")),
      { enableHighAccuracy: true, maximumAge: 10_000 },
    );
    setSharingLocation(true);
  }

  async function handleAdvance(assignment: CourierAssignmentView) {
    const next = NEXT_STATUS[assignment.status];
    if (!next) return;
    const result = await advanceCourierAssignment(assignment.id, next);
    if (result.ok) {
      if (next === "delivered") {
        setAssignments((prev) => prev.filter((a) => a.id !== assignment.id));
      } else {
        setAssignments((prev) => prev.map((a) => (a.id === assignment.id ? { ...a, status: next } : a)));
      }
    }
  }

  return (
    // Kurye yüzeyi tek elle, motor üstünde, güneşte okunuyor: dar kolon,
    // büyük adres tipografisi, tam genişlikte tek aksiyon. Kanban DEĞİL —
    // kuryenin aynı anda gördüğü teslimat sayısı zaten bir avuç, kolonlara
    // bölmek telefonda yalnızca kaydırma ekler.
    <OpsShell
      title={t("title")}
      width="narrow"
      actions={
        <Button
          type="button"
          variant={sharingLocation ? "default" : "outline"}
          onClick={handleToggleLocationSharing}
        >
          {sharingLocation ? t("locationSharing.stop") : t("locationSharing.start")}
        </Button>
      }
    >
      {locationError && (
        <p role="alert" className="mb-3 text-[13px] text-[var(--sem-err-fg)]">
          {locationError}
        </p>
      )}

      {assignments.length === 0 ? (
        <p className="rounded-[var(--r-md)] border border-dashed border-[var(--surface-line)] px-4 py-16 text-center text-[15px] text-[var(--surface-fg-muted)]">
          {t("noAssignments")}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {assignments.map((assignment) => {
            const next = NEXT_STATUS[assignment.status];
            return (
              <OpsCard key={assignment.id} tone={assignment.status === "en_route" ? "warn" : "accent"}>
                <div className="flex items-start justify-between gap-2 px-3.5 pt-3">
                  <h2 className="min-w-0 text-[17px] leading-snug font-semibold break-words text-[var(--surface-fg)]">
                    {assignment.addressSnapshot ?? "—"}
                  </h2>
                  <OpsBadge tone={assignment.status === "en_route" ? "warn" : "accent"}>
                    {t(`status.${assignment.status}`)}
                  </OpsBadge>
                </div>

                <p className="px-3.5 pt-1 text-[15px] font-bold tabular-nums text-[var(--surface-fg)]">
                  {formatPrice(assignment.subtotalMinor, currency)}
                </p>

                {next && (
                  <div className="px-3 py-3">
                    <Button type="button" className="w-full text-[15px] font-semibold" onClick={() => handleAdvance(assignment)}>
                      {t(`advanceTo.${next}`)}
                    </Button>
                  </div>
                )}
              </OpsCard>
            );
          })}
        </div>
      )}
    </OpsShell>
  );
}
