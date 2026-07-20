import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/types";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const SEED = {
  acme: {
    tenantId: "00000000-0000-4000-8000-000000000001",
    branchId: "00000000-0000-4000-8000-000000000011",
    ownerEmail: "owner@acme.test",
    managerEmail: "manager@acme.test", // session.move izni var (seed)
    waiterEmail: "waiter@acme.test", // hiçbir izni yok (fail-closed)
    table1Id: "00000000-0000-4000-8000-000000000501",
    table2Id: "00000000-0000-4000-8000-000000000502",
    table1Token: "demo-acme-table-1",
    table2Token: "demo-acme-table-2",
    genericToken: "demo-acme-generic",
  },
  beta: {
    tenantId: "00000000-0000-4000-8000-000000000002",
    branchId: "00000000-0000-4000-8000-000000000012",
    ownerEmail: "owner@beta.test",
    table1Id: "00000000-0000-4000-8000-000000000504",
    table1Token: "demo-beta-table-1",
    genericToken: "demo-beta-generic",
  },
  password: "password123",
};

export function serviceRoleClient() {
  return createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY);
}

export function anonClient() {
  return createClient<Database>(SUPABASE_URL, ANON_KEY);
}

export async function signInAsSeededOwner(email: string) {
  const client = createClient<Database>(SUPABASE_URL, ANON_KEY);
  const { error } = await client.auth.signInWithPassword({ email, password: SEED.password });
  if (error) {
    throw new Error(`Seeded owner sign-in failed for ${email}: ${error.message}`);
  }
  return client;
}

/**
 * Route Handler'ın (src/lib/guest/bootstrap.ts) yaptığı adımların Next.js
 * dışındaki (Vitest) karşılığı — aynı RPC'leri ve signInAnonymously/
 * refreshSession sırasını doğrudan supabase-js ile yürütür.
 */
export async function bootstrapGuestForTable(tableId: string) {
  const service = serviceRoleClient();
  const { data: tableSessionId, error: sessionError } = await service.rpc(
    "open_or_get_active_table_session",
    { p_table_id: tableId },
  );
  if (sessionError || !tableSessionId) {
    throw new Error(`open_or_get_active_table_session failed: ${sessionError?.message}`);
  }

  const { data: table, error: tableError } = await service
    .from("tables")
    .select("tenant_id, branch_id")
    .eq("id", tableId)
    .single();
  if (tableError || !table) {
    throw new Error(`table lookup failed: ${tableError?.message}`);
  }

  const guest = anonClient();
  const { data: authData, error: authError } = await guest.auth.signInAnonymously();
  if (authError || !authData.user) {
    throw new Error(`signInAnonymously failed: ${authError?.message}`);
  }

  const { error: linkError } = await service.rpc("link_guest_device", {
    p_guest_user_id: authData.user.id,
    p_table_session_id: tableSessionId,
    p_tenant_id: table.tenant_id,
    p_branch_id: table.branch_id,
  });
  if (linkError) {
    throw new Error(`link_guest_device failed: ${linkError.message}`);
  }

  await guest.auth.refreshSession();
  return { client: guest, tableSessionId: tableSessionId as string };
}
