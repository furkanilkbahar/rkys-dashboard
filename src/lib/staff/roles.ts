export const STAFF_MANAGEABLE_ROLES = ["owner", "manager", "waiter", "kitchen", "courier"] as const;
export type StaffRole = (typeof STAFF_MANAGEABLE_ROLES)[number];
