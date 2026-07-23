import { beforeEach, describe, expect, it, vi } from "vitest";

let mockResult: { data: unknown } = { data: null };
const rpc = vi.fn(async () => mockResult);

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ rpc })),
}));

const { isEnabled } = await import("@/lib/modules/isEnabled");

describe("isEnabled()", () => {
  beforeEach(() => {
    mockResult = { data: null };
  });

  it("RPC null döndürürse (satır yok) fail-closed: false döner", async () => {
    mockResult = { data: null };
    expect(await isEnabled("t1", "pos_cash")).toBe(false);
  });

  it("RPC false döndürürse false döner", async () => {
    mockResult = { data: false };
    expect(await isEnabled("t1", "pos_cash")).toBe(false);
  });

  it("RPC true döndürürse true döner", async () => {
    mockResult = { data: true };
    expect(await isEnabled("t1", "pos_cash")).toBe(true);
  });
});
