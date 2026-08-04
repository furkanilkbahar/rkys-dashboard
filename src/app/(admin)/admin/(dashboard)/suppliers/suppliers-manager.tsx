"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { DataTable } from "@/components/admin/data-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AdminSupplier } from "@/lib/data/suppliers";
import { supplierFormSchema, type InventoryActionResult, type SupplierFormInput } from "@/lib/inventory/schemas";

export function SuppliersManager({
  suppliers,
  createSupplier,
}: {
  suppliers: AdminSupplier[];
  createSupplier: (input: unknown) => Promise<InventoryActionResult>;
}) {
  const t = useTranslations("admin.suppliers");
  const tErrors = useTranslations("admin.suppliers.errors");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, reset } = useForm<SupplierFormInput>({
    resolver: standardSchemaResolver(supplierFormSchema),
    defaultValues: { name: "", contactInfo: "" },
  });

  async function onSubmit(values: SupplierFormInput) {
    setError(null);
    const result = await createSupplier(values);
    if (!result.ok) {
      setError(tErrors(result.error));
      return;
    }
    reset({ name: "", contactInfo: "" });
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-8">
      <AdminPageHeader title={t("pageTitle")} />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("title")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <DataTable
            rows={suppliers}
            rowKey={(supplier) => supplier.id}
            empty={t("empty")}
            initialSort={{ key: "name" }}
            columns={[
              {
                key: "name",
                header: t("name"),
                primary: true,
                value: (supplier) => supplier.name,
                cell: (supplier) => supplier.name,
              },
              {
                key: "contact",
                header: t("contactInfo"),
                value: (supplier) => supplier.contactInfo,
                cell: (supplier) =>
                  supplier.contactInfo ? (
                    <span className="text-[var(--surface-fg-muted)]">{supplier.contactInfo}</span>
                  ) : (
                    "—"
                  ),
              },
            ]}
          />

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-wrap items-end gap-2 border-t border-border pt-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="supplier-name">{t("name")}</Label>
              <Input id="supplier-name" className="w-40" {...register("name")} />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="supplier-contact">{t("contactInfo")}</Label>
              <Input id="supplier-contact" className="w-48" {...register("contactInfo")} />
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
