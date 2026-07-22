export type LicenseType = "lifetime" | "self_hosted";

export type LicensePayload = {
  tenantId: string;
  licenseType: LicenseType;
  issuedAt: string;
  expiresAt: string | null;
};
