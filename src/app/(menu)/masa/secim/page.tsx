import { getTranslations } from "next-intl/server";

import { hashToken } from "@/lib/qr/token";
import { createServiceRoleClient } from "@/lib/supabase/server";

import { selectTableForGenericQr } from "./actions";

export default async function TableSelectionPage({
  searchParams,
}: {
  searchParams: Promise<{ g?: string }>;
}) {
  const { g: rawToken } = await searchParams;
  const t = await getTranslations("menu.tableSelect");

  if (!rawToken) {
    return (
      <main className="flex min-h-screen items-center justify-center p-8 text-center">
        <p className="text-sm text-muted-foreground">{t("missingToken")}</p>
      </main>
    );
  }

  const service = createServiceRoleClient();
  const { data: tables } = await service.rpc("list_branch_tables_for_generic_qr", {
    p_token_hash: hashToken(rawToken),
  });

  if (!tables || tables.length === 0) {
    return (
      <main className="flex min-h-screen items-center justify-center p-8 text-center">
        <p className="text-sm text-muted-foreground">{t("invalidQr")}</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 p-8">
      <h1 className="text-lg font-semibold">{t("title")}</h1>
      <ul className="grid w-full max-w-sm grid-cols-2 gap-3">
        {tables.map((table) => (
          <li key={table.table_id}>
            <form action={selectTableForGenericQr}>
              <input type="hidden" name="rawToken" value={rawToken} />
              <input type="hidden" name="tableId" value={table.table_id} />
              <button
                type="submit"
                className="w-full rounded-md border border-border bg-background px-4 py-3 text-sm hover:bg-accent"
              >
                {table.label}
              </button>
            </form>
          </li>
        ))}
      </ul>
    </main>
  );
}
