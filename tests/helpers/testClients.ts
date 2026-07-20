import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/types";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const SEED = {
  acme: {
    tenantId: "00000000-0000-0000-0000-000000000001",
    branchId: "00000000-0000-0000-0000-000000000011",
    ownerEmail: "owner@acme.test",
  },
  beta: {
    tenantId: "00000000-0000-0000-0000-000000000002",
    branchId: "00000000-0000-0000-0000-000000000012",
    ownerEmail: "owner@beta.test",
  },
  password: "password123",
};

export function serviceRoleClient() {
  return createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY);
}

export async function signInAsSeededOwner(email: string) {
  const client = createClient<Database>(SUPABASE_URL, ANON_KEY);
  const { error } = await client.auth.signInWithPassword({ email, password: SEED.password });
  if (error) {
    throw new Error(`Seeded owner sign-in failed for ${email}: ${error.message}`);
  }
  return client;
}
