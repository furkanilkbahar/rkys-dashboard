"use client";

import { Bell } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { callWaiter } from "@/app/(menu)/masa/waiter-call-actions";
import type { CallTypeOption } from "@/lib/data/callTypes";

// PRD §4 "sticky Garson Çağır": tipsiz tek dokunuş + tenant'ın tanımlı
// tiplerinden seçim (D35).
//
// Faz 21: eskiden kendini `fixed bottom-24 right-4` ile konumluyordu ve sepet
// çubuğunun üstünde ayrı bir baloncuk olarak duruyordu. §2.2'ye göre alt çubuk
// TEK bir birimdir (sepet + garson çağır), o yüzden bileşen artık satır içi —
// konumlandırmayı CartBar yapar.
//
// §5: erişilebilir ad DEĞİŞMEDİ. Buton artık ikonlu ama `aria-label` hâlâ
// t("callWaiter") — waiter-call-realtime.spec.ts'in
// getByRole("button", { name: "Garson Çağır" }) locator'ı aynen çalışır.
export function WaiterCallButton({ callTypes }: { callTypes: CallTypeOption[] }) {
  const t = useTranslations("menu.waiterCall");
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorKey, setErrorKey] = useState<string | null>(null);

  async function send(callTypeKey: string | null) {
    setStatus("sending");
    setOpen(false);
    const result = await callWaiter({ callTypeKey });
    if (result.ok) {
      setStatus("sent");
      setTimeout(() => setStatus("idle"), 4000);
    } else {
      setStatus("error");
      setErrorKey(result.error ?? "unknown");
      setTimeout(() => setStatus("idle"), 4000);
    }
  }

  const showPopover = open || status === "sent" || status === "error";

  return (
    <div className="relative flex shrink-0 items-stretch">
      {/* Tip listesi ve geri bildirim çubuğun ÜSTÜNDE açılır. */}
      {showPopover && (
        <div className="absolute right-0 bottom-[calc(100%+8px)] z-10 flex min-w-[190px] flex-col items-end gap-1.5">
          {status === "sent" && (
            <p className="rounded-full bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-[var(--accent-fg)] shadow-lg">
              {t("sent")}
            </p>
          )}
          {status === "error" && (
            <p className="rounded-full bg-[var(--destructive)] px-3 py-1.5 text-xs font-medium text-white shadow-lg">
              {t(errorKey ?? "unknown")}
            </p>
          )}
          {open && callTypes.length > 0 && (
            <div className="flex w-full flex-col gap-0.5 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--card)] p-1.5 shadow-lg">
              {callTypes.map((type) => (
                <button
                  key={type.key}
                  type="button"
                  className="min-h-11 rounded-[var(--radius-img)] px-3 text-left text-sm hover:bg-[var(--card-2)]"
                  onClick={() => send(type.key)}
                >
                  {type.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        disabled={status === "sending"}
        aria-label={t("callWaiter")}
        aria-expanded={callTypes.length > 0 ? open : undefined}
        onClick={() => (callTypes.length > 0 ? setOpen((v) => !v) : send(null))}
        className="flex size-[52px] items-center justify-center rounded-full border border-[var(--line)] bg-[var(--card)]/90 text-[var(--fg)] shadow-lg backdrop-blur transition-transform duration-[var(--dur-fast)] ease-[var(--ease-out)] active:scale-95 disabled:opacity-60"
      >
        <Bell className="size-5" aria-hidden="true" />
      </button>
    </div>
  );
}
