"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AdminMarketplaceMapping, SelectableProduct } from "@/lib/data/marketplace";
import { MARKETPLACE_PROVIDERS, mappingFormSchema, type MappingFormInput, type MarketplaceActionResult } from "@/lib/marketplace/schemas";

export function MarketplaceManager({
  mappings,
  products,
  createMapping,
  deleteMapping,
}: {
  mappings: AdminMarketplaceMapping[];
  products: SelectableProduct[];
  createMapping: (input: unknown) => Promise<MarketplaceActionResult>;
  deleteMapping: (mappingId: string) => Promise<MarketplaceActionResult>;
}) {
  const t = useTranslations("admin.marketplace");
  const tErrors = useTranslations("admin.marketplace.errors");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const { register, control, handleSubmit, reset } = useForm<MappingFormInput>({
    resolver: standardSchemaResolver(mappingFormSchema),
    defaultValues: { provider: "mock", externalSku: "", productId: "" },
  });

  async function onSubmit(values: MappingFormInput) {
    setError(null);
    const result = await createMapping(values);
    if (!result.ok) {
      setError(tErrors(result.error));
      return;
    }
    reset({ provider: "mock", externalSku: "", productId: "" });
    router.refresh();
  }

  async function handleDelete(mappingId: string) {
    await deleteMapping(mappingId);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-xl font-semibold">{t("pageTitle")}</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("title")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {mappings.length === 0 && <p className="text-sm text-muted-foreground">{t("empty")}</p>}
          {mappings.map((mapping) => (
            <div key={mapping.id} className="flex items-center justify-between gap-2 rounded-md border border-border p-2 text-sm">
              <span>
                <span className="font-medium">{mapping.provider}</span>
                {" · "}
                <code className="text-xs">{mapping.externalSku}</code>
                {" → "}
                <span>{mapping.productName}</span>
              </span>
              <Button type="button" variant="ghost" size="sm" onClick={() => handleDelete(mapping.id)}>
                {t("remove")}
              </Button>
            </div>
          ))}

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-wrap items-end gap-2 border-t border-border pt-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="mapping-provider">{t("provider")}</Label>
              <Controller
                control={control}
                name="provider"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="mapping-provider" className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MARKETPLACE_PROVIDERS.map((provider) => (
                        <SelectItem key={provider} value={provider}>
                          {provider}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="mapping-sku">{t("externalSku")}</Label>
              <Input id="mapping-sku" className="w-40" {...register("externalSku")} />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="mapping-product">{t("product")}</Label>
              <Controller
                control={control}
                name="productId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={(v) => field.onChange(v ?? "")}>
                    <SelectTrigger id="mapping-product" className="w-48">
                      <SelectValue placeholder={t("productPlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
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
