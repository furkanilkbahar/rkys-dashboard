"use server";

import { headers } from "next/headers";

import { getCurrentActor } from "@/lib/auth/session";
import { getDefaultSubscriptionProvider } from "@/lib/subscriptions";
import { createClient } from "@/lib/supabase/server";

export type BillingActionResult =
  | { ok: true; checkoutUrl?: string }
  | { ok: false; error: "forbidden" | "unknown" };

export async function startSubscriptionCheckout(planId: string): Promise<BillingActionResult> {
  const actor = await getCurrentActor();
  if (!actor || actor.role !== "owner") return { ok: false, error: "forbidden" };

  const headerStore = await headers();
  const origin = `${headerStore.get("x-forwarded-proto") ?? "http"}://${headerStore.get("host")}`;
  const provider = getDefaultSubscriptionProvider();

  const checkout = await provider.createSubscriptionCheckout({
    tenantId: actor.tenantId,
    planId,
    returnUrl: `${origin}/admin/billing`,
  });

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_subscription_checkout_ref", {
    p_provider: provider.name,
    p_provider_ref: checkout.providerRef,
  });
  if (error) return { ok: false, error: "unknown" };

  return { ok: true, checkoutUrl: checkout.checkoutUrl };
}

export async function cancelSubscription(): Promise<BillingActionResult> {
  const actor = await getCurrentActor();
  if (!actor || actor.role !== "owner") return { ok: false, error: "forbidden" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_subscription");
  if (error) return { ok: false, error: "unknown" };

  return { ok: true };
}
