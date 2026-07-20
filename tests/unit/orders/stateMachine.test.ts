import { describe, expect, it } from "vitest";

import { canGuestCancelDirectly, canGuestRequestCancellation, canTransition } from "@/lib/orders/stateMachine";

describe("sipariş durum makinesi", () => {
  it("pending -> approved ve pending -> cancelled geçerlidir", () => {
    expect(canTransition("pending", "approved")).toBe(true);
    expect(canTransition("pending", "cancelled")).toBe(true);
  });

  it("pending -> served atlaması geçersizdir (RULES #24)", () => {
    expect(canTransition("pending", "served")).toBe(false);
  });

  it("preparing -> cancelled doğrudan geçersizdir (D22 karma iptal)", () => {
    expect(canTransition("preparing", "cancelled")).toBe(false);
  });

  it("served ve cancelled son durumlardır, hiçbir geçişe izin vermez", () => {
    expect(canTransition("served", "pending")).toBe(false);
    expect(canTransition("cancelled", "pending")).toBe(false);
  });

  it("misafir yalnızca pending/approved'ı doğrudan iptal edebilir", () => {
    expect(canGuestCancelDirectly("pending")).toBe(true);
    expect(canGuestCancelDirectly("approved")).toBe(true);
    expect(canGuestCancelDirectly("preparing")).toBe(false);
  });

  it("misafir yalnızca preparing'de iptal isteği açabilir", () => {
    expect(canGuestRequestCancellation("preparing")).toBe(true);
    expect(canGuestRequestCancellation("pending")).toBe(false);
  });
});
