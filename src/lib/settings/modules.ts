// tenant_modules.module_key CHECK constraint (0005_tenant_modules.sql) ile
// birebir aynı liste — client-safe (server-only bağımlılığı yok), nav
// filtreleme client component'inde de kullanılabilir.
export const TENANT_MODULE_KEYS = [
  "pos_cash",
  "inventory",
  "recipes",
  "crm_loyalty",
  "campaigns",
  "gift_cards",
  "pickup",
  "delivery",
  "courier",
  "marketplace",
  "reservations",
  "kiosk",
  "staff_scheduling",
  "accounting_export",
  "api_access",
] as const;

export type TenantModuleKey = (typeof TENANT_MODULE_KEYS)[number];
