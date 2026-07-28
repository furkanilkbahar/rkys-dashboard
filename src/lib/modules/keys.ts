// tenant_modules.module_key CHECK constraint (0005_tenant_modules.sql) ile
// birebir aynı liste — server-only bağımlılığı yok, client component'ler
// (nav filtreleme, ayarlar/onboarding modül matrisi) doğrudan import edebilir.
export const MODULE_KEYS = [
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
  "fiscal_integration",
] as const;

export type ModuleKey = (typeof MODULE_KEYS)[number];
