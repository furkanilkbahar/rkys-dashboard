import { z } from "zod";

export const apiKeyFormSchema = z.object({
  name: z.string().min(1, "required"),
});
export type ApiKeyFormInput = z.infer<typeof apiKeyFormSchema>;

export type ApiKeyActionResult =
  | { ok: true; rawKey: string }
  | { ok: false; error: "invalid_input" | "forbidden" | "not_enabled" | "unknown" };

export type RevokeApiKeyResult = { ok: true } | { ok: false; error: "forbidden" | "unknown" };
