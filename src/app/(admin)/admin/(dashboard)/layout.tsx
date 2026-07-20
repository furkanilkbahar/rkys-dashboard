import { AdminShell } from "@/components/admin/admin-shell";
import { getCurrentTenant } from "@/lib/data/tenant";
import { requireAdminActor } from "@/lib/auth/adminGuard";

export default async function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireAdminActor();
  const tenant = await getCurrentTenant();

  return (
    <AdminShell tenantLabel={tenant?.slug ?? actor.tenantId} role={actor.role}>
      {children}
    </AdminShell>
  );
}
