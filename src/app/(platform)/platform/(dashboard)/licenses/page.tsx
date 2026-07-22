import { getPlatformLicenses } from "@/lib/data/platformLicenses";
import { getPlatformTenants } from "@/lib/data/platformTenants";

import { createLicense } from "./actions";
import { LicensesManager } from "./licenses-manager";

export default async function PlatformLicensesPage() {
  const [licenses, tenants] = await Promise.all([getPlatformLicenses(), getPlatformTenants()]);

  return <LicensesManager licenses={licenses} tenants={tenants} createLicense={createLicense} />;
}
