import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/server";

export type ContactRequestStatus = "new" | "contacted" | "closed";

export type PlatformContactRequest = {
  id: string;
  name: string;
  businessName: string | null;
  email: string;
  phone: string | null;
  message: string;
  status: ContactRequestStatus;
  createdAt: string;
};

// Pazarlama sitesi iletişim/demo talep formu (Faz 13 Adım 2, S58) — platform
// admin görünümü, tenant izolasyonu gerektirmez, service-role kullanılır
// (platformTenants.ts'teki aynı gerekçe: gate zaten layout'ta yapılıyor).
export async function getContactRequests(): Promise<PlatformContactRequest[]> {
  const service = createServiceRoleClient();
  const { data } = await service
    .from("contact_requests")
    .select("id, name, business_name, email, phone, message, status, created_at")
    .order("created_at", { ascending: false });

  return (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    businessName: r.business_name,
    email: r.email,
    phone: r.phone,
    message: r.message,
    status: r.status as ContactRequestStatus,
    createdAt: r.created_at,
  }));
}
