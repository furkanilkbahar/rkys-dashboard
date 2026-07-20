"use server";

import { redirect } from "next/navigation";

import { bootstrapGuestSessionForTable } from "@/lib/guest/bootstrap";
import { selectTableSchema } from "@/lib/guest/schemas";
import { hashToken } from "@/lib/qr/token";
import { createServiceRoleClient } from "@/lib/supabase/server";

export async function selectTableForGenericQr(formData: FormData) {
  const parsed = selectTableSchema.safeParse({
    rawToken: formData.get("rawToken"),
    tableId: formData.get("tableId"),
  });

  if (!parsed.success) {
    redirect("/masa/gecersiz");
  }

  const { rawToken, tableId } = parsed.data;
  const tokenHash = hashToken(rawToken);

  // Token↔masa eşleşmesi yeniden doğrulanır — client'ın gönderdiği tableId'ye
  // körü körüne güvenilmez (RULES #10 sınır doğrulaması, sahtecilik önleme).
  const service = createServiceRoleClient();
  const { data: matches } = await service.rpc("list_branch_tables_for_generic_qr", {
    p_token_hash: tokenHash,
  });

  const isValidPair = matches?.some((row) => row.table_id === tableId) ?? false;
  if (!isValidPair) {
    redirect("/masa/gecersiz");
  }

  const ok = await bootstrapGuestSessionForTable(tableId);
  redirect(ok ? "/masa" : "/masa/gecersiz");
}
