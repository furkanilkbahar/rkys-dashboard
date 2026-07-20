import { describe, expect, it } from "vitest";

import { SEED, anonClient, signInAsSeededOwner } from "../../helpers/testClients";

// 1x1 şeffaf PNG — yükleme testleri için minimal geçerli görsel.
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

describe("Storage: menu-images bucket izolasyonu", () => {
  it("staff kendi tenant klasörüne yükleyebilir", async () => {
    const owner = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const path = `${SEED.acme.tenantId}/products/test-${Date.now()}.png`;

    const { error } = await owner.storage.from("menu-images").upload(path, TINY_PNG, { contentType: "image/png" });
    expect(error).toBeNull();

    await owner.storage.from("menu-images").remove([path]);
  });

  it("staff başka tenant'ın klasörüne yükleyemez", async () => {
    const owner = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const path = `${SEED.beta.tenantId}/products/test-${Date.now()}.png`;

    const { error } = await owner.storage.from("menu-images").upload(path, TINY_PNG, { contentType: "image/png" });
    expect(error).not.toBeNull();
  });

  it("misafir (anon) yükleme yapamaz ama public URL üzerinden okuyabilir", async () => {
    const owner = await signInAsSeededOwner(SEED.acme.ownerEmail);
    const path = `${SEED.acme.tenantId}/products/public-read-${Date.now()}.png`;
    await owner.storage.from("menu-images").upload(path, TINY_PNG, { contentType: "image/png" });

    const anon = anonClient();
    const { error: anonUploadError } = await anon.storage
      .from("menu-images")
      .upload(`${SEED.acme.tenantId}/products/anon-${Date.now()}.png`, TINY_PNG, { contentType: "image/png" });
    expect(anonUploadError).not.toBeNull();

    const { data: publicUrlData } = anon.storage.from("menu-images").getPublicUrl(path);
    const response = await fetch(publicUrlData.publicUrl);
    expect(response.status).toBe(200);

    await owner.storage.from("menu-images").remove([path]);
  });
});
