"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { DataTable, DataTableActions } from "@/components/admin/data-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ApiKeyActionResult, ApiKeyFormInput, RevokeApiKeyResult } from "@/lib/api/schemas";
import { apiKeyFormSchema } from "@/lib/api/schemas";
import type { AdminApiKey } from "@/lib/data/apiKeys";

export function ApiKeysManager({
  keys,
  createKey,
  revokeKey,
}: {
  keys: AdminApiKey[];
  createKey: (input: unknown) => Promise<ApiKeyActionResult>;
  revokeKey: (keyId: string) => Promise<RevokeApiKeyResult>;
}) {
  const t = useTranslations("admin.apiKeys");
  const tGrid = useTranslations("admin.table");
  const tErrors = useTranslations("admin.apiKeys.errors");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [newRawKey, setNewRawKey] = useState<string | null>(null);
  const { register, handleSubmit, reset } = useForm<ApiKeyFormInput>({
    resolver: standardSchemaResolver(apiKeyFormSchema),
    defaultValues: { name: "" },
  });

  async function onSubmit(values: ApiKeyFormInput) {
    setError(null);
    setNewRawKey(null);
    const result = await createKey(values);
    if (!result.ok) {
      setError(tErrors(result.error));
      return;
    }
    setNewRawKey(result.rawKey);
    reset({ name: "" });
    router.refresh();
  }

  async function handleRevoke(keyId: string) {
    await revokeKey(keyId);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-8">
      <AdminPageHeader title={t("pageTitle")} />
      {newRawKey && (
        <div className="flex flex-col gap-1 rounded-md border border-primary/30 bg-primary/10 p-3 text-sm">
          <p className="font-medium">{t("newKeyWarning")}</p>
          <code className="break-all rounded bg-background px-2 py-1 text-xs">{newRawKey}</code>
        </div>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("title")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <DataTable
            rows={keys}
            rowKey={(key) => key.id}
            empty={t("empty")}
            initialSort={{ key: "name" }}
            columns={[
              {
                key: "name",
                header: t("name"),
                primary: true,
                value: (key) => key.name,
                cell: (key) => key.name,
              },
              {
                key: "prefix",
                header: t("prefix"),
                value: (key) => key.keyPrefix,
                // `<code>` DEĞİL: bu sayfada yeni oluşturulan ham anahtar
                // tek `<code>` öğesi ve api-keys/marketplace spec'leri onu
                // `page.locator("code")` ile okuyor. Önek hücresini de
                // `<code>` yapmak o locator'ı iki öğeye düşürüyordu.
                cell: (key) => (
                  <span className="font-mono text-[11.5px] text-[var(--surface-fg-muted)]">•••• {key.keyPrefix}</span>
                ),
              },
              {
                key: "status",
                header: tGrid("status"),
                value: (key) => (key.isActive ? 1 : 0),
                cell: (key) => (
                  <span className="text-[var(--surface-fg-muted)]">{key.isActive ? t("active") : t("revoked")}</span>
                ),
              },
              {
                key: "actions",
                header: tGrid("actions"),
                actions: true,
                align: "end",
                cell: (key) =>
                  key.isActive ? (
                    <DataTableActions>
                      <Button type="button" size="sm" variant="destructive" onClick={() => handleRevoke(key.id)}>
                        {t("revoke")}
                      </Button>
                    </DataTableActions>
                  ) : null,
              },
            ]}
          />

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-wrap items-end gap-2 border-t border-border pt-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="api-key-name">{t("name")}</Label>
              <Input id="api-key-name" className="w-48" {...register("name")} />
            </div>
            <Button type="submit" size="sm">
              {t("add")}
            </Button>
          </form>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
