import { beforeEach, describe, expect, it, vi } from "vitest";

interface QueryChain {
  eq: (column: string, value: unknown) => QueryChain;
  maybeSingle: () => Promise<{ data: unknown }>;
}

function makeChain(result: { data: unknown }): QueryChain {
  const chain: QueryChain = {
    eq: () => chain,
    maybeSingle: async () => result,
  };
  return chain;
}

let mockResult: { data: unknown } = { data: null };
const from = vi.fn(() => ({ select: vi.fn(() => makeChain(mockResult)) }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from })),
}));

const { can } = await import("@/lib/auth/can");

describe("can()", () => {
  beforeEach(() => {
    mockResult = { data: null };
    from.mockClear();
  });

  it("owner her zaman izinlidir, role_permissions sorgulanmaz", async () => {
    const allowed = await can({ userId: "u1", tenantId: "t1", role: "owner" }, "refund");
    expect(allowed).toBe(true);
    expect(from).not.toHaveBeenCalled();
  });

  it("satır yoksa fail-closed: false döner", async () => {
    mockResult = { data: null };
    const allowed = await can({ userId: "u1", tenantId: "t1", role: "manager" }, "refund");
    expect(allowed).toBe(false);
  });

  it("satır allowed=false ise false döner", async () => {
    mockResult = { data: { allowed: false } };
    const allowed = await can({ userId: "u1", tenantId: "t1", role: "manager" }, "refund");
    expect(allowed).toBe(false);
  });

  it("satır allowed=true ise true döner", async () => {
    mockResult = { data: { allowed: true } };
    const allowed = await can({ userId: "u1", tenantId: "t1", role: "manager" }, "refund");
    expect(allowed).toBe(true);
  });
});
