import { describe, expect, it } from "vitest";

import { shouldRedirectToGoogle } from "@/lib/ratings/schemas";

describe("shouldRedirectToGoogle (RULES #30)", () => {
  it("4-5★ ve tanımlı url'de yönlendirir", () => {
    expect(shouldRedirectToGoogle(4, "https://g.page/r/example/review")).toBe(true);
    expect(shouldRedirectToGoogle(5, "https://g.page/r/example/review")).toBe(true);
  });

  it("≤3★ hiçbir koşulda yönlendirmez", () => {
    expect(shouldRedirectToGoogle(1, "https://g.page/r/example/review")).toBe(false);
    expect(shouldRedirectToGoogle(2, "https://g.page/r/example/review")).toBe(false);
    expect(shouldRedirectToGoogle(3, "https://g.page/r/example/review")).toBe(false);
  });

  it("url tanımlı değilse 5★ olsa bile yönlendirmez", () => {
    expect(shouldRedirectToGoogle(5, null)).toBe(false);
  });
});
