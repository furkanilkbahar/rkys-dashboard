"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { ClockActionResult } from "@/lib/scheduling/schemas";

export function PinPad({
  clockInOrOut,
  forgetDevice,
}: {
  clockInOrOut: (input: unknown) => Promise<ClockActionResult>;
  forgetDevice: () => Promise<void>;
}) {
  const t = useTranslations("timeclock");
  const tErrors = useTranslations("timeclock.errors");
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function press(digit: string) {
    setError(null);
    setMessage(null);
    if (pin.length < 8) {
      setPin((prev) => prev + digit);
    }
  }

  function clear() {
    setPin("");
    setError(null);
    setMessage(null);
  }

  async function submit() {
    setPending(true);
    setError(null);
    setMessage(null);
    const result = await clockInOrOut({ pin });
    setPending(false);
    setPin("");
    if (!result.ok) {
      setError(tErrors(result.error));
      return;
    }
    setMessage(result.action === "in" ? t("clockedIn", { badge: result.badgeNo ?? "" }) : t("clockedOut", { badge: result.badgeNo ?? "" }));
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex h-12 items-center justify-center rounded-md border border-border px-6 text-2xl tracking-widest">
        {"•".repeat(pin.length) || <span className="text-muted-foreground">{t("pinPlaceholder")}</span>}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map((key, index) =>
          key === "" ? (
            <div key={index} />
          ) : (
            <Button
              key={index}
              type="button"
              variant="outline"
              className="h-14 w-14 text-lg"
              onClick={() => (key === "⌫" ? setPin((prev) => prev.slice(0, -1)) : press(key))}
            >
              {key}
            </Button>
          ),
        )}
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="ghost" onClick={clear} disabled={pending}>
          {t("clear")}
        </Button>
        <Button type="button" onClick={submit} disabled={pending || pin.length === 0}>
          {t("submit")}
        </Button>
      </div>
      {message && <p className="text-sm font-medium text-primary">{message}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <button
        type="button"
        className="text-xs text-muted-foreground underline"
        onClick={async () => {
          await forgetDevice();
          router.refresh();
        }}
      >
        {t("forgetDevice")}
      </button>
    </div>
  );
}
