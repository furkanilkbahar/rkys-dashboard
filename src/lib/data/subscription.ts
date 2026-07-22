import "server-only";

import { createClient } from "@/lib/supabase/server";

export type AdminSubscription = {
  status: "trialing" | "active" | "past_due" | "canceled";
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  provider: string | null;
  trialDaysLeft: number | null;
};

export async function isSubscriptionActive(tenantId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("is_subscription_active", { p_tenant_id: tenantId });
  return data ?? false;
}

export async function getAdminSubscription(tenantId: string): Promise<AdminSubscription | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("subscriptions")
    .select("status, trial_ends_at, current_period_end, provider")
    .eq("tenant_id", tenantId)
    .single();

  if (!data) return null;

  return {
    status: data.status as AdminSubscription["status"],
    trialEndsAt: data.trial_ends_at,
    currentPeriodEnd: data.current_period_end,
    provider: data.provider,
    trialDaysLeft: data.trial_ends_at
      ? Math.max(0, Math.ceil((new Date(data.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
      : null,
  };
}
