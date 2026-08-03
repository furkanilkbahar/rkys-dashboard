"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { PlatformPageHeader } from "@/components/platform/platform-page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { PlatformLicense } from "@/lib/data/platformLicenses";
import type { PlatformTenant } from "@/lib/data/platformTenants";
import { licenseFormSchema, type CreateLicenseResult, type LicenseFormInput } from "@/lib/platform/schemas";

export function LicensesManager({
  licenses,
  tenants,
  createLicense,
}: {
  licenses: PlatformLicense[];
  tenants: PlatformTenant[];
  createLicense: (input: unknown) => Promise<CreateLicenseResult>;
}) {
  const t = useTranslations("platform.licenses");
  const [newLicenseKey, setNewLicenseKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [licenseType, setLicenseType] = useState<LicenseFormInput["licenseType"]>("lifetime");
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { isSubmitting },
  } = useForm<LicenseFormInput>({
    resolver: standardSchemaResolver(licenseFormSchema),
    defaultValues: { tenantId: tenants[0]?.id ?? "", licenseType: "lifetime", expiresAt: "" },
  });

  async function onSubmit(values: LicenseFormInput) {
    setError(null);
    setNewLicenseKey(null);
    const result = await createLicense(values);
    if (!result.ok) {
      setError(t("error"));
      return;
    }
    setNewLicenseKey(result.licenseKey);
    setLicenseType("lifetime");
    reset({ tenantId: values.tenantId, licenseType: "lifetime", expiresAt: "" });
  }

  return (
    <div className="flex flex-col gap-6">
      <PlatformPageHeader title={t("title")} />

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3 rounded-md border border-border p-4">
        <div className="flex flex-col gap-1">
          <Label htmlFor="license-tenant">{t("tenant")}</Label>
          <Controller
            control={control}
            name="tenantId"
            render={({ field }) => (
              <Select value={field.value} onValueChange={(value) => field.onChange(value ?? "")}>
                <SelectTrigger className="w-64" id="license-tenant">
                  <SelectValue placeholder={t("tenant")} />
                </SelectTrigger>
                <SelectContent>
                  {tenants.map((tenant) => (
                    <SelectItem key={tenant.id} value={tenant.id}>
                      {tenant.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="license-type">{t("licenseType")}</Label>
          <Controller
            control={control}
            name="licenseType"
            render={({ field }) => (
              <select
                id="license-type"
                className="h-9 w-64 rounded-md border border-input bg-transparent px-3 text-sm"
                value={field.value}
                onChange={(e) => {
                  const value = e.target.value as LicenseFormInput["licenseType"];
                  field.onChange(value);
                  setLicenseType(value);
                }}
              >
                <option value="lifetime">{t("type.lifetime")}</option>
                <option value="self_hosted">{t("type.self_hosted")}</option>
              </select>
            )}
          />
        </div>

        {licenseType === "self_hosted" && (
          <div className="flex flex-col gap-1">
            <Label htmlFor="license-expires">{t("expiresAt")}</Label>
            <Input id="license-expires" type="date" className="w-64" {...register("expiresAt")} />
          </div>
        )}

        <Button type="submit" disabled={isSubmitting} className="self-start">
          {t("generate")}
        </Button>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </form>

      {newLicenseKey && (
        <div className="flex flex-col gap-2 rounded-md border border-border bg-accent/30 p-4">
          <p className="text-sm font-medium">{t("generatedTitle")}</p>
          <p className="break-all rounded-md bg-background p-2 font-mono text-xs">{newLicenseKey}</p>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {licenses.length === 0 && <p className="text-sm text-muted-foreground">{t("empty")}</p>}
        {licenses.map((license) => (
          <div key={license.id} className="flex flex-col gap-1 rounded-md border border-border p-3 text-sm">
            <div className="flex items-center gap-2">
              <span className="font-medium">{license.tenantName}</span>
              <Badge variant="secondary">{t(`type.${license.licenseType}`)}</Badge>
              {license.expiresAt && (
                <span className="text-muted-foreground">
                  {t("expiresAtLabel", { date: new Date(license.expiresAt).toLocaleDateString("tr-TR") })}
                </span>
              )}
            </div>
            <p className="break-all font-mono text-xs text-muted-foreground">{license.licenseKey}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
