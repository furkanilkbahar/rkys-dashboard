"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

import type { WaiterLoginResult } from "./actions";

export function PinLoginPad({ loginWithPin }: { loginWithPin: (input: unknown) => Promise<WaiterLoginResult> }) {
  const t = useTranslations("waiterLogin");
  const tErrors = useTranslations("waiterLogin.errors");
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function press(digit: string) {
    setError(null);
    if (pin.length < 8) {
      setPin((prev) => prev + digit);
    }
  }

  function clear() {
    setPin("");
    setError(null);
  }

  async function submit() {
    setPending(true);
    setError(null);
    const result = await loginWithPin({ pin });
    setPending(false);
    setPin("");
    if (!result.ok) {
      setError(tErrors(result.error));
      return;
    }
    router.push("/waiter");
    router.refresh();
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex h-14 min-w-[14rem] items-center justify-center rounded-[var(--r-sm)] border border-[var(--surface-line-strong)] bg-[var(--surface-panel)] px-6 text-[26px] tracking-[0.35em]">
        {"•".repeat(pin.length) || <span className="text-[15px] tracking-normal text-[var(--surface-fg-muted)]">{t("pinPlaceholder")}</span>}
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map((key, index) =>
          key === "" ? (
            <div key={index} />
          ) : (
            <Button
              key={index}
              type="button"
              variant="outline"
              className="size-16 text-[20px] font-semibold"
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
      {error && <p role="alert" className="text-[14px] text-[var(--sem-err-fg)]">{error}</p>}
    </div>
  );
}
