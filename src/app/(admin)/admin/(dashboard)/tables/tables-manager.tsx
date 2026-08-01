"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";

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
  const tZones = useTranslations("admin.tables.zones");
  const tGeneric = useTranslations("admin.tables.genericQr");
  const tErrors = useTranslations("admin.tables.errors");
  const router = useRouter();
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [revealError, setRevealError] = useState<string | null>(null);

  async function handleRegenerateTable(tableId: string, label: string) {
    if (!window.confirm(tTable("regenerateConfirm"))) return;
    const result = await actions.regenerateTableQr(tableId);
    if (result.ok) setReveal({ label, guestPath: result.guestPath });
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
    const result = await actions.regenerateGenericQr(id);
    if (result.ok) setReveal({ label, guestPath: result.guestPath });
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-xl font-semibold">{t("title")}</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{tZones("title")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {zones.length === 0 && <p className="text-sm text-muted-foreground">{tZones("empty")}</p>}
          {zones.map((zone) => (
            <div key={zone.id} className="flex items-center justify-between gap-2 text-sm">
              <div className="flex items-center gap-2">
                <span>{zone.name}</span>
                <Badge variant={zone.isActive ? "secondary" : "destructive"}>
                  {zone.isActive ? tTable("active") : "—"}
                </Badge>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={() => handleToggleZone(zone)}>
                {zone.isActive ? tZones("archive") : tZones("activate")}
              </Button>
            </div>
          ))}
          <ZoneForm branchId={branchId} createZone={actions.createZone} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{tTable("title")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {tables.length === 0 && <p className="text-sm text-muted-foreground">{tTable("empty")}</p>}
          {tables.map((table) => (
            <div
              key={table.id}
              data-testid={`table-row-${table.id}`}
              className="flex items-center justify-between gap-2 rounded-md border border-border p-2 text-sm"
            >
              <div className="flex items-center gap-2">
                <span className="font-medium">{table.label}</span>
                {table.zoneName && <span className="text-xs text-muted-foreground">({table.zoneName})</span>}
                <Badge variant={table.isActive ? "secondary" : "destructive"}>
                  {table.isActive ? tTable("active") : "—"}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => handleToggleTable(table)}>
                  {table.isActive ? tTable("archive") : tTable("activate")}
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => handleRevealTable(table.id, table.label)}>
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
              </div>
            </div>
          ))}
          <TableForm branchId={branchId} zones={zones} createTable={actions.createTable} onRevealed={setReveal} />
          {revealError && <p className="text-xs text-destructive">{revealError}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{tGeneric("title")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {genericQrCodes.length === 0 && <p className="text-sm text-muted-foreground">{tGeneric("empty")}</p>}
          {genericQrCodes.map((qr) => (
            <div key={qr.id} className="flex items-center justify-between gap-2 rounded-md border border-border p-2 text-sm">
              <span className="font-medium">{qr.label}</span>
              <div className="flex items-center gap-2">
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
              </div>
            </div>
          ))}
          <GenericQrForm branchId={branchId} createGenericQr={actions.createGenericQr} onRevealed={setReveal} />
        </CardContent>
      </Card>

      {reveal && (
        <QrRevealCard label={reveal.label} guestPath={reveal.guestPath} onClose={() => setReveal(null)} />
      )}
    </div>
  );
}
