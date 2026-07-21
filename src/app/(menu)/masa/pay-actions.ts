"use server";

import { headers } from "next/headers";

import { getDefaultPaymentProvider } from "@/lib/payments";
import { getCurrentGuestSession } from "@/lib/guest/session";
import { createClient } from "@/lib/supabase/server";

export type StartOnlinePaymentResult =
  | { ok: true; checkoutUrl: string }
  | { ok: false; error: "no_session" | "nothing_to_pay" | "unknown" };

export async function startOnlinePayment(): Promise<StartOnlinePaymentResult> {
  const guest = await getCurrentGuestSession();
  if (!guest) {
    return { ok: false, error: "no_session" };
  }

  const supabase = await createClient();
  const [{ data: orders }, { data: payments }, { data: tenant }] = await Promise.all([
    supabase.from("orders").select("subtotal_minor").eq("table_session_id", guest.tableSessionId).neq("status", "cancelled"),
    supabase.from("payments").select("amount_minor").eq("table_session_id", guest.tableSessionId).eq("status", "completed"),
    supabase.from("tenants").select("currency").eq("id", guest.tenantId).maybeSingle(),
  ]);

  const subtotalMinor = (orders ?? []).reduce((sum, o) => sum + o.subtotal_minor, 0);
  const paidMinor = (payments ?? []).reduce((sum, p) => sum + p.amount_minor, 0);
  const balanceMinor = subtotalMinor - paidMinor;

  if (balanceMinor <= 0) {
    return { ok: false, error: "nothing_to_pay" };
  }

  const headerStore = await headers();
  const origin = `${headerStore.get("x-forwarded-proto") ?? "http"}://${headerStore.get("host")}`;

  const provider = getDefaultPaymentProvider();
  const session = await provider.createCheckoutSession({
    tableSessionId: guest.tableSessionId,
    amountMinor: balanceMinor,
    currency: tenant?.currency ?? "TRY",
    returnUrl: `${origin}/masa`,
  });

  const { error } = await supabase.rpc("create_pending_online_payment", {
    p_table_session_id: guest.tableSessionId,
    p_amount_minor: balanceMinor,
    p_tip_amount_minor: 0,
    p_provider: provider.name,
    p_provider_ref: session.providerRef,
  });
  if (error) {
    return { ok: false, error: "unknown" };
  }

  return { ok: true, checkoutUrl: session.checkoutUrl };
}
