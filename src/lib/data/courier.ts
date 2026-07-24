import "server-only";

import { createClient } from "@/lib/supabase/server";

export type CourierOption = { id: string; badgeNo: string | null };

export async function getCouriers(tenantId: string): Promise<CourierOption[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("id, badge_no").eq("tenant_id", tenantId).eq("role", "courier").eq("is_active", true);

  return (data ?? []).map((p) => ({ id: p.id, badgeNo: p.badge_no }));
}

export type DeliveryOrderView = {
  id: string;
  addressSnapshot: string | null;
  subtotalMinor: number;
  assignment: { id: string; courierId: string; status: "assigned" | "en_route" | "delivered" } | null;
};

/** Teslim edilmemiş (delivered değil) tüm delivery siparişleri — atanmış/atanmamış. */
export async function getDeliveryOrders(tenantId: string, branchId: string): Promise<DeliveryOrderView[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select("id, delivery_address_snapshot, subtotal_minor, courier_assignments(id, courier_id, status)")
    .eq("tenant_id", tenantId)
    .eq("branch_id", branchId)
    .eq("channel", "delivery")
    .neq("status", "cancelled")
    .order("created_at");

  return (data ?? [])
    .filter((o) => o.courier_assignments?.status !== "delivered")
    .map((o) => ({
      id: o.id,
      addressSnapshot: o.delivery_address_snapshot,
      subtotalMinor: o.subtotal_minor,
      assignment: o.courier_assignments
        ? { id: o.courier_assignments.id, courierId: o.courier_assignments.courier_id, status: o.courier_assignments.status as "assigned" | "en_route" | "delivered" }
        : null,
    }));
}

export type CourierAssignmentView = {
  id: string;
  status: "assigned" | "en_route" | "delivered";
  orderId: string;
  addressSnapshot: string | null;
  subtotalMinor: number;
};

/** Bir kuryenin kendi (henüz teslim etmediği) atamaları. */
export async function getCourierAssignments(tenantId: string, courierId: string): Promise<CourierAssignmentView[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("courier_assignments")
    .select("id, status, orders(id, delivery_address_snapshot, subtotal_minor)")
    .eq("tenant_id", tenantId)
    .eq("courier_id", courierId)
    .neq("status", "delivered")
    .order("assigned_at");

  return (data ?? [])
    .filter((a) => a.orders)
    .map((a) => ({
      id: a.id,
      status: a.status as "assigned" | "en_route" | "delivered",
      orderId: a.orders!.id,
      addressSnapshot: a.orders!.delivery_address_snapshot,
      subtotalMinor: a.orders!.subtotal_minor,
    }));
}
