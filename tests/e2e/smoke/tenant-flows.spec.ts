import { expect, test } from "@playwright/test";

const SEED = {
  acme: { slug: "acme", ownerEmail: "owner@acme.test" },
  beta: { slug: "beta", ownerEmail: "owner@beta.test" },
  password: "password123",
};

function tenantUrl(baseURL: string, slug: string, path = "/") {
  const url = new URL(baseURL);
  url.hostname = `${slug}.${url.hostname}`;
  url.pathname = path;
  return url.toString();
}

async function loginAs(page: import("@playwright/test").Page, baseURL: string, slug: string, email: string) {
  await page.goto(tenantUrl(baseURL, slug, "/admin/login"));
  await page.getByLabel("E-posta").fill(email);
  await page.getByLabel("Şifre").fill(SEED.password);
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await page.waitForURL(/\/admin$/);
}

test("acme ve beta subdomain'leri /api/health'te farklı tenant döner", async ({ request, baseURL }) => {
  const acmeRes = await request.get(tenantUrl(baseURL!, SEED.acme.slug, "/api/health"));
  const betaRes = await request.get(tenantUrl(baseURL!, SEED.beta.slug, "/api/health"));

  const acmeBody = await acmeRes.json();
  const betaBody = await betaRes.json();

  expect(acmeBody.tenant.slug).toBe("acme");
  expect(betaBody.tenant.slug).toBe("beta");
  expect(acmeBody.tenant.id).not.toBe(betaBody.tenant.id);
});

test("seed owner ile giriş /admin'de tenant+rol bilgisini gösterir", async ({ page, baseURL }) => {
  await loginAs(page, baseURL!, SEED.acme.slug, SEED.acme.ownerEmail);
  await expect(page.getByText(/Hoş geldin, owner/)).toBeVisible();
});

test("pos_cash açık tenant'ta kasa erişilebilir, kapalı tenant'ta 404 döner", async ({ page, baseURL }) => {
  await loginAs(page, baseURL!, SEED.acme.slug, SEED.acme.ownerEmail);
  await page.goto(tenantUrl(baseURL!, SEED.acme.slug, "/cashier"));
  await expect(page.getByText("RKYS Dashboard — kasa (Faz 3)")).toBeVisible();

  await loginAs(page, baseURL!, SEED.beta.slug, SEED.beta.ownerEmail);
  const betaCashierResponse = await page.goto(tenantUrl(baseURL!, SEED.beta.slug, "/cashier"));
  expect(betaCashierResponse?.status()).toBe(404);
});
