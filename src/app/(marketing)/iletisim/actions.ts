"use server";

import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const contactRequestSchema = z.object({
  name: z.string().min(1, "required"),
  businessName: z.string(),
  email: z.email(),
  phone: z.string(),
  message: z.string().min(1, "required"),
});

export type ContactActionResult = { ok: true } | { ok: false; error: "invalid_input" | "unknown" };

export async function submitContactRequest(input: unknown): Promise<ContactActionResult> {
  const parsed = contactRequestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_contact_request", {
    p_name: parsed.data.name,
    p_business_name: (parsed.data.businessName || null) as string,
    p_email: parsed.data.email,
    p_phone: (parsed.data.phone || null) as string,
    p_message: parsed.data.message,
  });
  if (error) return { ok: false, error: "unknown" };

  return { ok: true };
}
