"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { callWaiter } from "@/app/(menu)/masa/waiter-call-actions";
import { Button } from "@/components/ui/button";
import type { CallTypeOption } from "@/lib/data/callTypes";

// PRD §4 "sticky Garson Çağır": tipsiz tek dokunuş + tenant'ın tanımlı
// tiplerinden seçim (D35).
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

  return (
    <div className="fixed bottom-24 right-4 z-20 flex flex-col items-end gap-2">
      {open && (
        <div className="flex flex-col gap-1 rounded-md border border-border bg-background p-2 shadow-lg">
          {callTypes.map((type) => (
            <button
              key={type.key}
              type="button"
              className="rounded-md px-3 py-2 text-left text-sm hover:bg-accent"
              onClick={() => send(type.key)}
            >
              {type.name}
            </button>
          ))}
        </div>
      )}
      {status === "sent" && <p className="rounded-md bg-primary px-3 py-1 text-xs text-primary-foreground">{t("sent")}</p>}
      {status === "error" && <p className="rounded-md bg-destructive px-3 py-1 text-xs text-white">{t(errorKey ?? "unknown")}</p>}
      <Button
        type="button"
        disabled={status === "sending"}
        onClick={() => (callTypes.length > 0 ? setOpen((v) => !v) : send(null))}
        className="rounded-full shadow-lg"
      >
        {t("callWaiter")}
      </Button>
    </div>
  );
}
