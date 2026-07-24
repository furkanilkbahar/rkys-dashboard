export type AccountingActionResult = { ok: true; externalRef: string } | { ok: false; error: "forbidden" | "not_enabled" | "already_synced" | "unknown" };
