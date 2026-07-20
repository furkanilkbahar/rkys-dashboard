import "server-only";

import { redirect } from "next/navigation";

import { getCurrentActor, type CurrentActor } from "./session";

/**
 * Admin panel için ortak giriş kontrolü — actor yoksa /admin/login'e
 * yönlendirir. (admin)/admin/(dashboard)/layout.tsx tarafından çağrılır;
 * login sayfası bu route grubunun dışında kaldığı için yönlendirme
 * döngüsü oluşmaz.
 */
export async function requireAdminActor(): Promise<CurrentActor> {
  const actor = await getCurrentActor();

  if (!actor) {
    redirect("/admin/login");
  }

  return actor;
}
