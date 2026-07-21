import "server-only";

import { createClient } from "@/lib/supabase/server";

export async function isOnboardingCompleted(tenantId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.from("tenants").select("onboarding_completed_at").eq("id", tenantId).single();
  return data?.onboarding_completed_at !== null && data?.onboarding_completed_at !== undefined;
}
