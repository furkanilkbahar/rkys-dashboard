import "server-only";

import { createClient } from "@/lib/supabase/server";

export type ActiveAnnouncement = {
  id: string;
  title: string;
  body: string;
};

/**
 * Admin panelinde üstte gösterilecek, o an aktif olan tek duyuru (varsa).
 * Zaman aralığı filtreleri announcements_select_active RLS politikasıyla
 * aynı — RLS zaten bunu garanti eder, burada tekrarlanması yalnızca en
 * güncel olanı seçmek için (birden fazla aktif duyuru varsa).
 */
export async function getActiveAnnouncement(): Promise<ActiveAnnouncement | null> {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  const { data } = await supabase
    .from("announcements")
    .select("id, title, body")
    .eq("is_active", true)
    .lte("starts_at", nowIso)
    .or(`ends_at.is.null,ends_at.gte.${nowIso}`)
    .order("starts_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data ?? null;
}
