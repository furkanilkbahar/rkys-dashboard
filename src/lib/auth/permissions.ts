export const PERMISSION_KEYS = [
  "comp_discount",
  "refund",
  "reports.revenue",
  "reports.profit",
  "menu.edit",
  "cash.open_close",
  "session.move",
  "reservations.manage",
  "staff.manage",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];
