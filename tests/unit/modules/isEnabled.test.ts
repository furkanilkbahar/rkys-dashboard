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

const { isEnabled } = await import("@/lib/modules/isEnabled");

describe("isEnabled()", () => {
  beforeEach(() => {
    mockResult = { data: null };
  });

  it("satır yoksa fail-closed: false döner", async () => {
    mockResult = { data: null };
    expect(await isEnabled("t1", "pos_cash")).toBe(false);
  });

  it("is_enabled=false ise false döner", async () => {
    mockResult = { data: { is_enabled: false } };
    expect(await isEnabled("t1", "pos_cash")).toBe(false);
  });

  it("is_enabled=true ise true döner", async () => {
    mockResult = { data: { is_enabled: true } };
    expect(await isEnabled("t1", "pos_cash")).toBe(true);
  });
});
