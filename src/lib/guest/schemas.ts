import { z } from "zod";

export const selectTableSchema = z.object({
  rawToken: z.string().min(1),
  tableId: z.uuid(),
});

export type SelectTableInput = z.infer<typeof selectTableSchema>;
