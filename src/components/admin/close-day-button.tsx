"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { closeBusinessDay } from "@/app/(admin)/admin/(dashboard)/reports/actions";
import { Button } from "@/components/ui/button";

export function CloseDayButton({ branchId }: { branchId: string }) {
  const t = useTranslations("admin.reports");
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (!window.confirm(t("closeDayConfirm"))) return;
    setPending(true);
    setError(null);
    const result = await closeBusinessDay(branchId);
    setPending(false);
    if (!result.ok) {
      setError(t(`errors.${result.error}`));
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-1">
      <Button type="button" variant="destructive" size="sm" disabled={pending} onClick={handleClick}>
        {pending ? t("closingDay") : t("closeDay")}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
