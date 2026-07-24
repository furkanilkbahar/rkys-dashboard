"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { advanceCourierAssignment } from "@/app/(waiter)/waiter/courier-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CourierAssignmentView } from "@/lib/data/courier";
import { formatPrice } from "@/lib/utils/currency";

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
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 p-4 sm:p-8">
      <h1 className="text-lg font-semibold">{t("title")}</h1>
      {assignments.length === 0 && <p className="text-sm text-muted-foreground">{t("noAssignments")}</p>}
      {assignments.map((assignment) => {
        const next = NEXT_STATUS[assignment.status];
        return (
          <Card key={assignment.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-sm">
                <span>{assignment.addressSnapshot ?? "—"}</span>
                <span className="text-xs text-muted-foreground">{t(`status.${assignment.status}`)}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">{formatPrice(assignment.subtotalMinor, currency)}</span>
              {next && (
                <Button type="button" size="sm" onClick={() => handleAdvance(assignment)}>
                  {t(`advanceTo.${next}`)}
                </Button>
              )}
            </CardContent>
          </Card>
        );
      })}
    </main>
  );
}
