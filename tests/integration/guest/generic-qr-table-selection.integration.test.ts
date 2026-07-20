import { describe, expect, it } from "vitest";

import { hashToken } from "@/lib/qr/token";

import { SEED, anonClient, serviceRoleClient } from "../../helpers/testClients";

describe("Misafir: genel QR → masa seçim akışı (RULES #32)", () => {
  it("geçerli genel QR hash'i yalnızca o tenant'ın masalarını listeler", async () => {
    const { data, error } = await serviceRoleClient().rpc("list_branch_tables_for_generic_qr", {
      p_token_hash: hashToken(SEED.acme.genericToken),
    });

    expect(error).toBeNull();
    expect(data?.some((row) => row.table_id === SEED.acme.table1Id)).toBe(true);
    expect(data?.some((row) => row.table_id === SEED.beta.table1Id)).toBe(false);
  });

  it("geçersiz genel QR hash'i boş liste döner", async () => {
    const { data, error } = await serviceRoleClient().rpc("list_branch_tables_for_generic_qr", {
      p_token_hash: "0".repeat(64),
    });

    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("masa seçilmeden önce anonim girişte misafir claim'leri hiç oluşmaz", async () => {
    const guest = anonClient();
    const { error: authError } = await guest.auth.signInAnonymously();
    expect(authError).toBeNull();

    const { data } = await guest.auth.getClaims();
    const claims = data?.claims as Record<string, unknown>;

    expect(claims.user_role ?? null).not.toBe("guest");
    expect(claims.table_session_id ?? null).toBeFalsy();
  });
});
