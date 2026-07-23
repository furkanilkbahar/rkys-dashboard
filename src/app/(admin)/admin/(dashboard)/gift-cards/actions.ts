"use server";

import { revalidatePath } from "next/cache";

import { getCurrentActor } from "@/lib/auth/session";
import { initialBalanceMinor, issueGiftCardFormSchema, type GiftCardActionResult } from "@/lib/giftCards/schemas";
import { createClient } from "@/lib/supabase/server";

export async function issueGiftCard(input: unknown): Promise<GiftCardActionResult> {
  const actor = await getCurrentActor();
  if (!actor) return { ok: false, error: "forbidden" };

  const parsed = issueGiftCardFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("issue_gift_card", {
    p_code: parsed.data.code.toUpperCase(),
    p_initial_balance_minor: initialBalanceMinor(parsed.data),
  });

  if (error) {
    if (error.message.includes("gift_cards module not enabled")) return { ok: false, error: "not_enabled" };
    if (error.message.includes("duplicate key")) return { ok: false, error: "duplicate_code" };
    if (error.message.includes("staff only")) return { ok: false, error: "forbidden" };
    return { ok: false, error: "unknown" };
  }

  revalidatePath("/admin/gift-cards");
  return { ok: true };
}
