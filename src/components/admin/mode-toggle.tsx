"use client";

import { Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";

import { setMode } from "@/themes/mode-actions";
import type { Mode } from "@/themes/mode";

/**
 * Faz 21 (§2.3) — çift mod anahtarı. Koyu varsayılan, açık tam desteklenir.
 *
 * Tercih server action'la cookie'ye yazılır ve `revalidatePath` kök layout'u
 * yeniden çizer; `<html data-mode>` sunucuda doğru değerle gelir, flaş yok.
 * Bu bileşen yalnızca tıklamayı taşır — tema mantığı client'ta yaşamaz.
 */
export function ModeToggle({ mode }: { mode: Mode }) {
  const t = useTranslations("admin.nav");
  const [pending, startTransition] = useTransition();
  const next: Mode = mode === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      disabled={pending}
      aria-label={t(next === "light" ? "modeLight" : "modeDark")}
      onClick={() => startTransition(() => void setMode(next))}
      className="flex size-[26px] items-center justify-center rounded-[var(--radius)] text-[var(--surface-fg-muted)] transition-colors duration-[var(--dur-fast)] ease-[var(--ease-out)] hover:text-[var(--surface-fg)] disabled:opacity-50"
    >
      {mode === "dark" ? (
        <Sun className="size-4" aria-hidden="true" />
      ) : (
        <Moon className="size-4" aria-hidden="true" />
      )}
    </button>
  );
}
