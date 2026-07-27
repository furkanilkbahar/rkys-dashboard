import { expect, test } from "@playwright/test";

import { loginAsPlatformAdmin } from "../helpers/tenant";

test("S64: platform admin bir modülün à la carte fiyatını değiştirebilir", async ({ page, baseURL }) => {
  await loginAsPlatformAdmin(page, baseURL!);
  await page.goto(`${baseURL}/platform/plans`);

  await expect(page.getByText("Modül Fiyatları (Ek Satın Alma)")).toBeVisible();

  const kioskRow = page.getByTestId("addon-price-row-kiosk");
  const saveButton = kioskRow.getByRole("button", { name: "Kaydet" });
  await kioskRow.getByRole("spinbutton").fill("750");
  await saveButton.click();
  await expect(saveButton).toBeEnabled();

  await page.reload();
  await expect(page.getByTestId("addon-price-row-kiosk").getByRole("spinbutton")).toHaveValue("750");
});
