"use server";

import { revalidatePath } from "next/cache";

import { getCurrentPlatformAdmin } from "@/lib/auth/platformSession";
import { announcementFormSchema, type PlatformActionResult } from "@/lib/platform/schemas";
import { createClient } from "@/lib/supabase/server";

export async function createAnnouncement(input: unknown): Promise<PlatformActionResult> {
  const admin = await getCurrentPlatformAdmin();
  if (!admin) return { ok: false, error: "forbidden" };

  const parsed = announcementFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const supabase = await createClient();
  const { error } = await supabase.from("announcements").insert({
    title: parsed.data.title,
    body: parsed.data.body,
    ends_at: parsed.data.endsAt || null,
  });
  if (error) return { ok: false, error: "unknown" };

  revalidatePath("/platform/announcements");
  return { ok: true };
}

export async function setAnnouncementActive(id: string, isActive: boolean): Promise<PlatformActionResult> {
  const admin = await getCurrentPlatformAdmin();
  if (!admin) return { ok: false, error: "forbidden" };

  const supabase = await createClient();
  const { error } = await supabase.from("announcements").update({ is_active: isActive }).eq("id", id);
  if (error) return { ok: false, error: "unknown" };

  revalidatePath("/platform/announcements");
  return { ok: true };
}

export async function deleteAnnouncement(id: string): Promise<PlatformActionResult> {
  const admin = await getCurrentPlatformAdmin();
  if (!admin) return { ok: false, error: "forbidden" };

  const supabase = await createClient();
  const { error } = await supabase.from("announcements").delete().eq("id", id);
  if (error) return { ok: false, error: "unknown" };

  revalidatePath("/platform/announcements");
  return { ok: true };
}
