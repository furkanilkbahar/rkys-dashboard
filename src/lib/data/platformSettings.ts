import "server-only";

import { createClient } from "@/lib/supabase/server";

export type PlatformSettings = {
  enforce2fa: boolean;
};

export async function getPlatformSettings(): Promise<PlatformSettings> {
  const supabase = await createClient();
  const { data } = await supabase.from("platform_settings").select("enforce_2fa").eq("id", true).single();

  return { enforce2fa: data?.enforce_2fa ?? false };
}
