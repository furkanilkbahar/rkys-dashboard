import "server-only";

import { createClient } from "@/lib/supabase/server";

export type PlatformAnnouncement = {
  id: string;
  title: string;
  body: string;
  startsAt: string;
  endsAt: string | null;
  isActive: boolean;
  createdAt: string;
};

// requirePlatformAdmin() zaten sayfa seviyesinde gate yapıyor; buradaki
// çağıran her zaman platform admin olduğu için announcements_platform_admin_all
// RLS politikası doğrudan izin veriyor — service-role'a gerek yok
// (platformTenants.ts'in aksine, burada başka tenant'ların verisine değil,
// yalnızca platforma ait announcements tablosuna erişiliyor).
export async function listPlatformAnnouncements(): Promise<PlatformAnnouncement[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("announcements")
    .select("id, title, body, starts_at, ends_at, is_active, created_at")
    .order("created_at", { ascending: false });

  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    isActive: row.is_active,
    createdAt: row.created_at,
  }));
}
