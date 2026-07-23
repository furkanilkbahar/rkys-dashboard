"use server";

import { revalidatePath } from "next/cache";

import {
  buildRuleConfig,
  campaignFormSchema,
  couponFormSchema,
  type CampaignActionResult,
} from "@/lib/campaigns/schemas";
import { getCurrentActor } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";

async function requireStaffActor() {
  return getCurrentActor();
}

export async function createCampaign(input: unknown): Promise<CampaignActionResult> {
  const actor = await requireStaffActor();
  if (!actor) return { ok: false, error: "forbidden" };

  const parsed = campaignFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const supabase = await createClient();
  const { error } = await supabase.from("campaigns").insert({
    tenant_id: actor.tenantId,
    name: parsed.data.name,
    rule_type: parsed.data.ruleType,
    rule_config: buildRuleConfig(parsed.data) as Json,
    is_active: parsed.data.isActive,
  });
  if (error) return { ok: false, error: "unknown" };

  revalidatePath("/admin/campaigns");
  return { ok: true };
}

export async function toggleCampaign(campaignId: string, isActive: boolean): Promise<CampaignActionResult> {
  const actor = await requireStaffActor();
  if (!actor) return { ok: false, error: "forbidden" };

  const supabase = await createClient();
  const { error } = await supabase.from("campaigns").update({ is_active: isActive }).eq("id", campaignId).eq("tenant_id", actor.tenantId);
  if (error) return { ok: false, error: "unknown" };

  revalidatePath("/admin/campaigns");
  return { ok: true };
}

export async function deleteCampaign(campaignId: string): Promise<CampaignActionResult> {
  const actor = await requireStaffActor();
  if (!actor) return { ok: false, error: "forbidden" };

  const supabase = await createClient();
  const { error } = await supabase.from("campaigns").delete().eq("id", campaignId).eq("tenant_id", actor.tenantId);
  if (error) return { ok: false, error: "unknown" };

  revalidatePath("/admin/campaigns");
  return { ok: true };
}

export async function createCoupon(input: unknown): Promise<CampaignActionResult> {
  const actor = await requireStaffActor();
  if (!actor) return { ok: false, error: "forbidden" };

  const parsed = couponFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const supabase = await createClient();
  const { error } = await supabase.from("coupons").insert({
    tenant_id: actor.tenantId,
    campaign_id: parsed.data.campaignId,
    code: parsed.data.code.toUpperCase(),
    usage_limit: parsed.data.usageLimit ?? null,
    is_active: parsed.data.isActive,
  });
  if (error) {
    if (error.message.includes("duplicate key")) return { ok: false, error: "invalid_input" };
    return { ok: false, error: "unknown" };
  }

  revalidatePath("/admin/campaigns");
  return { ok: true };
}

export async function toggleCoupon(couponId: string, isActive: boolean): Promise<CampaignActionResult> {
  const actor = await requireStaffActor();
  if (!actor) return { ok: false, error: "forbidden" };

  const supabase = await createClient();
  const { error } = await supabase.from("coupons").update({ is_active: isActive }).eq("id", couponId).eq("tenant_id", actor.tenantId);
  if (error) return { ok: false, error: "unknown" };

  revalidatePath("/admin/campaigns");
  return { ok: true };
}

export async function deleteCoupon(couponId: string): Promise<CampaignActionResult> {
  const actor = await requireStaffActor();
  if (!actor) return { ok: false, error: "forbidden" };

  const supabase = await createClient();
  const { error } = await supabase.from("coupons").delete().eq("id", couponId).eq("tenant_id", actor.tenantId);
  if (error) return { ok: false, error: "unknown" };

  revalidatePath("/admin/campaigns");
  return { ok: true };
}
