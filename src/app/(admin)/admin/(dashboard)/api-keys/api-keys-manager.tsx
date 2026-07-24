"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

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
      <h1 className="text-xl font-semibold">{t("pageTitle")}</h1>
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
          {keys.length === 0 && <p className="text-sm text-muted-foreground">{t("empty")}</p>}
          {keys.map((key) => (
            <div key={key.id} className="flex items-center justify-between gap-2 rounded-md border border-border p-2 text-sm">
              <div className="flex flex-col">
                <span className="font-medium">{key.name}</span>
                <span className="text-xs text-muted-foreground">
                  •••• {key.keyPrefix} — {key.isActive ? t("active") : t("revoked")}
                </span>
              </div>
              {key.isActive && (
                <Button type="button" size="sm" variant="destructive" onClick={() => handleRevoke(key.id)}>
                  {t("revoke")}
                </Button>
              )}
            </div>
          ))}

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
