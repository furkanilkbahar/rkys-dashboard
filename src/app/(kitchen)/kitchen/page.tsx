import { notFound, redirect } from "next/navigation";

import { KdsPanel } from "@/components/kitchen/kds-panel";
import { getCurrentActor } from "@/lib/auth/session";
import { assertStaffRole } from "@/lib/auth/staffGuard";
import { getDefaultBranchId } from "@/lib/data/branch";
import { getOrdersByStatus, getStations } from "@/lib/data/staffOrders";
import { isSubscriptionActive } from "@/lib/data/subscription";

export default async function KitchenHomePage({
  searchParams,
}: {
  searchParams: Promise<{ station?: string }>;
}) {
  const actor = await getCurrentActor();
  if (!actor) {
    redirect("/admin/login");
  }
  // Faz 4 Adım 3 (S13): admin panelle aynı kısıtlama, bkz. (dashboard)/layout.tsx.
  if (!(await isSubscriptionActive(actor.tenantId))) {
    redirect("/admin/billing");
  }
  assertStaffRole(actor, ["owner", "manager", "kitchen"]);

  const branchId = await getDefaultBranchId(actor.tenantId);
  if (!branchId) {
    notFound();
  }

  const { station } = await searchParams;
  const [orders, stations] = await Promise.all([
    getOrdersByStatus(actor.tenantId, branchId, ["approved", "preparing", "ready"], station),
    getStations(actor.tenantId),
  ]);

  return (
    // KdsPanel'in `orders` state'i useState(initialOrders) ile yalnızca ilk
    // mount'ta okunur — router.push ile ?station= değişince aynı bileşen
    // örneği yeniden kullanılırsa yeni (filtrelenmiş) initialOrders prop'u
    // hiç işlenmez (bkz. CouponsCard'daki aynı desen, Faz 6 Adım 2). key ile
    // istasyon değişince tam remount zorlanır.
    <KdsPanel
      key={station ?? "all"}
      tenantId={actor.tenantId}
      branchId={branchId}
      initialOrders={orders}
      stations={stations}
      selectedStation={station ?? ""}
    />
  );
}
