"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { DataTable, DataTableActions } from "@/components/admin/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { AdminGenericQr, AdminTable, AdminZone } from "@/lib/data/adminTables";
import {
  genericQrFormSchema,
  tableFormSchema,
  zoneFormSchema,
  type QrRevealResult,
  type TableActionResult,
} from "@/lib/tables/schemas";

import { QrRevealCard } from "./qr-reveal-card";

type Reveal = { label: string; guestPath: string };

function ZoneForm({
  branchId,
  createZone,
}: {
  branchId: string;
  createZone: (branchId: string, input: unknown) => Promise<TableActionResult>;
}) {
  const t = useTranslations("admin.tables.zones");
  const tErrors = useTranslations("admin.tables.errors");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const { register, control, handleSubmit, reset } = useForm({
    resolver: standardSchemaResolver(zoneFormSchema),
    defaultValues: { name: "", isActive: true },
  });

  async function onSubmit(values: { name: string; isActive: boolean }) {
    setError(null);
    const result = await createZone(branchId, values);
    if (!result.ok) {
      setError(tErrors(result.error));
      return;
    }
    reset({ name: "", isActive: true });
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex items-end gap-2">
      <div className="flex flex-col gap-1">
        <Label htmlFor="zone-name">{t("name")}</Label>
        <Input id="zone-name" {...register("name")} />
      </div>
      <Controller
        control={control}
        name="isActive"
        render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />}
      />
      <Button type="submit" size="sm">
        {t("add")}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </form>
  );
}

function TableForm({
  branchId,
  zones,
  createTable,
  onRevealed,
}: {
  branchId: string;
  zones: AdminZone[];
  createTable: (branchId: string, input: unknown) => Promise<QrRevealResult>;
  onRevealed: (reveal: Reveal) => void;
}) {
  const t = useTranslations("admin.tables.table");
  const tZones = useTranslations("admin.tables.zones");
  const tErrors = useTranslations("admin.tables.errors");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const { register, control, handleSubmit, reset } = useForm({
    resolver: standardSchemaResolver(tableFormSchema),
    defaultValues: { label: "", zoneId: "" as string, isActive: true },
  });

  async function onSubmit(values: { label: string; zoneId: string; isActive: boolean }) {
    setError(null);
    const result = await createTable(branchId, values);
    if (!result.ok) {
      setError(tErrors(result.error));
      return;
    }
    onRevealed({ label: values.label, guestPath: result.guestPath });
    reset({ label: "", zoneId: "", isActive: true });
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex items-end gap-2">
      <div className="flex flex-col gap-1">
        <Label htmlFor="table-label">{t("label")}</Label>
        <Input id="table-label" {...register("label")} />
      </div>
      <div className="flex flex-col gap-1">
        <Label>{t("zone")}</Label>
        <Controller
          control={control}
          name="zoneId"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder={t("zone")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">{tZones("noZone")}</SelectItem>
                {zones.map((z) => (
                  <SelectItem key={z.id} value={z.id}>
                    {z.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>
      <Controller
        control={control}
        name="isActive"
        render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />}
      />
      <Button type="submit" size="sm">
        {t("add")}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </form>
  );
}

function GenericQrForm({
  branchId,
  createGenericQr,
  onRevealed,
}: {
  branchId: string;
  createGenericQr: (branchId: string, input: unknown) => Promise<QrRevealResult>;
  onRevealed: (reveal: Reveal) => void;
}) {
  const t = useTranslations("admin.tables.genericQr");
  const tErrors = useTranslations("admin.tables.errors");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, reset } = useForm({
    resolver: standardSchemaResolver(genericQrFormSchema),
    defaultValues: { label: "Genel QR" },
  });

  async function onSubmit(values: { label: string }) {
    setError(null);
    const result = await createGenericQr(branchId, values);
    if (!result.ok) {
      setError(tErrors(result.error));
      return;
    }
    onRevealed({ label: values.label, guestPath: result.guestPath });
    reset({ label: "Genel QR" });
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex items-end gap-2">
      <div className="flex flex-col gap-1">
        <Label htmlFor="generic-qr-label">{t("label")}</Label>
        <Input id="generic-qr-label" {...register("label")} />
      </div>
      <Button type="submit" size="sm">
        {t("add")}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </form>
  );
}

export function TablesManager({
  branchId,
  zones,
  tables,
  genericQrCodes,
  actions,
}: {
  branchId: string;
  zones: AdminZone[];
  tables: AdminTable[];
  genericQrCodes: AdminGenericQr[];
  actions: {
    createZone: (branchId: string, input: unknown) => Promise<TableActionResult>;
    updateZone: (zoneId: string, input: unknown) => Promise<TableActionResult>;
    createTable: (branchId: string, input: unknown) => Promise<QrRevealResult>;
    updateTable: (tableId: string, input: unknown) => Promise<TableActionResult>;
    regenerateTableQr: (tableId: string) => Promise<QrRevealResult>;
    revealTableQr: (tableId: string) => Promise<QrRevealResult>;
    createGenericQr: (branchId: string, input: unknown) => Promise<QrRevealResult>;
    regenerateGenericQr: (genericQrId: string) => Promise<QrRevealResult>;
    revealGenericQr: (genericQrId: string) => Promise<QrRevealResult>;
  };
}) {
  const t = useTranslations("admin.tables");
  const tTable = useTranslations("admin.tables.table");
  // Tablo-genel kolon başlıkları ("Durum", "İşlemler") tek yerde — 14 ayrı
  // ad alanına aynı iki dizeyi kopyalamak yerine `admin.table` paylaşılıyor.
  const tGrid = useTranslations("admin.table");
  const tZones = useTranslations("admin.tables.zones");
  const tGeneric = useTranslations("admin.tables.genericQr");
  const tErrors = useTranslations("admin.tables.errors");
  const router = useRouter();
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [revealError, setRevealError] = useState<string | null>(null);

  async function handleRegenerateTable(tableId: string, label: string) {
    if (!window.confirm(tTable("regenerateConfirm"))) return;
    setRevealError(null);
    const result = await actions.regenerateTableQr(tableId);
    if (result.ok) {
      setReveal({ label, guestPath: result.guestPath });
    } else {
      setRevealError(tErrors(result.error));
    }
  }

  async function handleRevealTable(tableId: string, label: string) {
    setRevealError(null);
    const result = await actions.revealTableQr(tableId);
    if (result.ok) {
      setReveal({ label, guestPath: result.guestPath });
    } else {
      setRevealError(result.error === "not_found" ? tErrors("revealUnavailable") : tErrors(result.error));
    }
  }

  async function handleRevealGeneric(id: string, label: string) {
    setRevealError(null);
    const result = await actions.revealGenericQr(id);
    if (result.ok) {
      setReveal({ label, guestPath: result.guestPath });
    } else {
      setRevealError(result.error === "not_found" ? tErrors("revealUnavailable") : tErrors(result.error));
    }
  }

  async function handleToggleZone(zone: AdminZone) {
    if (zone.isActive && !window.confirm(tZones("archiveConfirm"))) return;
    const result = await actions.updateZone(zone.id, { name: zone.name, isActive: !zone.isActive });
    if (result.ok) router.refresh();
  }

  async function handleToggleTable(table: AdminTable) {
    if (table.isActive && !window.confirm(tTable("archiveConfirm"))) return;
    const result = await actions.updateTable(table.id, {
      label: table.label,
      zoneId: table.zoneId ?? "",
      isActive: !table.isActive,
    });
    if (result.ok) router.refresh();
  }

  async function handleRegenerateGeneric(id: string, label: string) {
    if (!window.confirm(tTable("regenerateConfirm"))) return;
    setRevealError(null);
    const result = await actions.regenerateGenericQr(id);
    if (result.ok) {
      setReveal({ label, guestPath: result.guestPath });
    } else {
      setRevealError(tErrors(result.error));
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <AdminPageHeader title={t("title")} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{tZones("title")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <DataTable
            rows={zones}
            rowKey={(zone) => zone.id}
            empty={tZones("empty")}
            initialSort={{ key: "name" }}
            columns={[
              {
                key: "name",
                header: tZones("name"),
                primary: true,
                value: (zone) => zone.name,
                cell: (zone) => zone.name,
              },
              {
                key: "status",
                header: tGrid("status"),
                value: (zone) => (zone.isActive ? 1 : 0),
                cell: (zone) => (
                  <Badge variant={zone.isActive ? "secondary" : "destructive"}>
                    {zone.isActive ? tTable("active") : "—"}
                  </Badge>
                ),
              },
              {
                key: "actions",
                header: tGrid("actions"),
                actions: true,
                align: "end",
                cell: (zone) => (
                  <DataTableActions>
                    <Button type="button" size="sm" variant="outline" onClick={() => handleToggleZone(zone)}>
                      {zone.isActive ? tZones("archive") : tZones("activate")}
                    </Button>
                  </DataTableActions>
                ),
              },
            ]}
          />
          <ZoneForm branchId={branchId} createZone={actions.createZone} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{tTable("title")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <DataTable
            rows={tables}
            rowKey={(table) => table.id}
            // E2E sözleşmesi: table-qr-flow.spec.ts satırı
            // `[data-testid^="table-row-"]` ile buluyor (§5). Kart/tablo
            // düzeni değişti, locator yüzeyi DEĞİŞMEDİ.
            rowAttributes={(table) => ({ "data-testid": `table-row-${table.id}` })}
            empty={tTable("empty")}
            searchable
            initialSort={{ key: "label" }}
            columns={[
              {
                key: "label",
                header: tTable("label"),
                primary: true,
                value: (table) => table.label,
                cell: (table) => table.label,
              },
              {
                key: "zone",
                header: tTable("zone"),
                value: (table) => table.zoneName,
                cell: (table) =>
                  table.zoneName ? (
                    <span className="text-[var(--surface-fg-muted)]">{table.zoneName}</span>
                  ) : (
                    "—"
                  ),
              },
              {
                key: "status",
                header: tGrid("status"),
                value: (table) => (table.isActive ? 1 : 0),
                cell: (table) => (
                  <Badge variant={table.isActive ? "secondary" : "destructive"}>
                    {table.isActive ? tTable("active") : "—"}
                  </Badge>
                ),
              },
              {
                key: "actions",
                header: tGrid("actions"),
                actions: true,
                align: "end",
                cell: (table) => (
                  <DataTableActions>
                    <Button type="button" size="sm" variant="outline" onClick={() => handleToggleTable(table)}>
                      {table.isActive ? tTable("archive") : tTable("activate")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handleRevealTable(table.id, table.label)}
                    >
                      {tTable("showQr")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handleRegenerateTable(table.id, table.label)}
                    >
                      {tTable("regenerateQr")}
                    </Button>
                  </DataTableActions>
                ),
              },
            ]}
          />
          <TableForm branchId={branchId} zones={zones} createTable={actions.createTable} onRevealed={setReveal} />
          {revealError && <p className="text-xs text-destructive">{revealError}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{tGeneric("title")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <DataTable
            rows={genericQrCodes}
            rowKey={(qr) => qr.id}
            empty={tGeneric("empty")}
            initialSort={{ key: "label" }}
            columns={[
              {
                key: "label",
                header: tGeneric("label"),
                primary: true,
                value: (qr) => qr.label,
                cell: (qr) => qr.label,
              },
              {
                key: "actions",
                header: tGrid("actions"),
                actions: true,
                align: "end",
                cell: (qr) => (
                  <DataTableActions>
                    <Button type="button" size="sm" variant="outline" onClick={() => handleRevealGeneric(qr.id, qr.label)}>
                      {tTable("showQr")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handleRegenerateGeneric(qr.id, qr.label)}
                    >
                      {tTable("regenerateQr")}
                    </Button>
                  </DataTableActions>
                ),
              },
            ]}
          />
          <GenericQrForm branchId={branchId} createGenericQr={actions.createGenericQr} onRevealed={setReveal} />
          {revealError && <p className="text-xs text-destructive">{revealError}</p>}
        </CardContent>
      </Card>

      {reveal && (
        <QrRevealCard label={reveal.label} guestPath={reveal.guestPath} onClose={() => setReveal(null)} />
      )}
    </div>
  );
}
