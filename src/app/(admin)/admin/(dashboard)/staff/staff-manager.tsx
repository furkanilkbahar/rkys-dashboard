"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useLocale, useTranslations } from "next-intl";
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
import { PERMISSION_KEYS, type PermissionKey } from "@/lib/auth/permissions";
import type { AdminStaffDevice, AdminStaffMember, RolePermissionMatrix } from "@/lib/data/adminStaff";
import { STAFF_MANAGEABLE_ROLES, type StaffRole } from "@/lib/staff/roles";
import {
  createStaffMemberFormSchema,
  deviceFormSchema,
  pinResetFormSchema,
  staffUpdateFormSchema,
  type DeviceActionResult,
  type StaffActionResult,
  type StaffPinRevealResult,
} from "@/lib/staff/schemas";

const PERMISSION_MATRIX_ROLES: StaffRole[] = ["manager", "waiter", "kitchen", "courier"];

function StaffRow({
  member,
  updateStaffMember,
  resetStaffPin,
  revealStaffPin,
  regenerateStaffPin,
}: {
  member: AdminStaffMember;
  updateStaffMember: (profileId: string, input: unknown) => Promise<StaffActionResult>;
  resetStaffPin: (profileId: string, input: unknown) => Promise<StaffActionResult>;
  revealStaffPin: (profileId: string) => Promise<StaffPinRevealResult>;
  regenerateStaffPin: (profileId: string) => Promise<StaffPinRevealResult>;
}) {
  const t = useTranslations("admin.staff");
  const tRole = useTranslations("admin.staff.role");
  const tErrors = useTranslations("admin.staff.errors");
  const tCommon = useTranslations("admin.common");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [showPinForm, setShowPinForm] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  // D102: gösterilen PIN ekranda kalıcı DEĞİL — kullanıcı "Onayla"ya basana
  // kadar duruyor, sonra siliniyor (cihaz şifresindeki desenin aynısı).
  const [revealedPin, setRevealedPin] = useState<string | null>(null);
  const [pinBusy, setPinBusy] = useState(false);
  // PIN üretmek sunucudaki durumu değiştirir ama router.refresh() BURADA
  // çağrılamaz: yenileme satırı yeniden çizip PIN kutusunu kapatıyordu, yani
  // kullanıcı yeni PIN'i göremeden kaybediyordu (E2E ile yakalandı). Rozet
  // yerelde güncellenir, tablo ise kutu kapatılırken tazelenir.
  const [hasPin, setHasPin] = useState(member.hasPin);

  async function runPinAction(action: () => Promise<StaffPinRevealResult>) {
    setPinError(null);
    setRevealedPin(null);
    setPinBusy(true);
    const result = await action();
    setPinBusy(false);
    if (!result.ok) {
      setPinError(tErrors(result.error === "not_found" ? "pin_not_revealable" : result.error));
      return;
    }
    setRevealedPin(result.pin);
    setHasPin(true);
  }

  function closeRevealedPin() {
    setRevealedPin(null);
    // Tablodaki "PIN tanımlı/yok" kolonu ancak sunucudan gelir; kutu
    // kapanırken tazelemek, PIN'i ekrandan düşürmeden onu da güncel tutar.
    router.refresh();
  }

  const { register, control, handleSubmit } = useForm({
    resolver: standardSchemaResolver(staffUpdateFormSchema),
    defaultValues: {
      fullName: member.fullName ?? "",
      role: member.role,
      badgeNo: member.badgeNo ?? "",
      isActive: member.isActive,
    },
  });

  const pinForm = useForm({
    resolver: standardSchemaResolver(pinResetFormSchema),
    defaultValues: { pin: "" },
  });

  async function onSubmit(values: { fullName: string; role: StaffRole; badgeNo: string; isActive: boolean }) {
    setError(null);
    const result = await updateStaffMember(member.id, values);
    if (!result.ok) {
      setError(tErrors(result.error));
      return;
    }
    router.refresh();
  }

  async function onPinSubmit(values: { pin: string }) {
    setPinError(null);
    const result = await resetStaffPin(member.id, values);
    if (!result.ok) {
      setPinError(tErrors(result.error));
      return;
    }
    setShowPinForm(false);
    pinForm.reset({ pin: "" });
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor={`full-name-${member.id}`}>{t("member.fullName")}</Label>
          <Input id={`full-name-${member.id}`} {...register("fullName")} className="w-44" />
        </div>
        <Controller
          control={control}
          name="role"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger className="w-36" aria-label={t("member.role")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STAFF_MANAGEABLE_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {tRole(r)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        <div className="flex flex-col gap-1">
          <Label htmlFor={`badge-no-${member.id}`}>{t("member.badgeNo")}</Label>
          <Input id={`badge-no-${member.id}`} {...register("badgeNo")} className="w-32" />
        </div>
        <div className="flex items-center gap-2">
          <Controller
            control={control}
            name="isActive"
            render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />}
          />
          <Label>{t("member.active")}</Label>
        </div>
        <Badge variant="secondary">{hasPin ? t("member.pinSet") : t("member.pinNotSet")}</Badge>
        <Button type="submit" size="sm">
          {t("member.save")}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setShowPinForm((v) => !v)}>
          {t("member.resetPin")}
        </Button>
        {/* D102: PIN'i sıfırlamadan gösterir — şifreli kopyası yoksa (anahtar
            ayarlanmadan önce atanmış PIN) uydurmaz, "yenileyin" der. */}
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!hasPin || pinBusy}
          onClick={() => runPinAction(() => revealStaffPin(member.id))}
        >
          {t("member.showPin")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pinBusy}
          onClick={() => runPinAction(() => regenerateStaffPin(member.id))}
        >
          {t("member.generatePin")}
        </Button>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </form>

      {showPinForm && (
        <form onSubmit={pinForm.handleSubmit(onPinSubmit)} className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor={`new-pin-${member.id}`}>{t("member.newPin")}</Label>
            <Input id={`new-pin-${member.id}`} inputMode="numeric" {...pinForm.register("pin")} className="w-40" />
          </div>
          <Button type="submit" size="sm" variant="outline">
            {t("member.resetPin")}
          </Button>
        </form>
      )}

      {pinError && <p className="text-xs text-destructive">{pinError}</p>}

      {revealedPin && (
        <div className="rounded-md border border-border p-3" data-testid={`revealed-pin-${member.id}`}>
          <p className="text-sm font-semibold">{t("member.pinRevealTitle")}</p>
          <p className="font-mono text-lg tracking-widest">{revealedPin}</p>
          <p className="text-xs text-destructive">{t("member.pinRevealWarning")}</p>
          <Button type="button" size="sm" className="mt-2" onClick={closeRevealedPin}>
            {tCommon("confirm")}
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * Faz 23 (D94) — personel listesi.
 *
 * Önceden 8 personel yan yana 8 AÇIK FORM olarak çiziliyordu ve satırların
 * kimlik kolonu yoktu: kim kim belli değildi (`profiles`'ta ad kolonu hiç
 * yoktu, e-posta `auth.users`'ta ve RLS altında okunamıyor). 0091 ile
 * `full_name` eklendi; liste artık tablo, düzenleyici ise satırın altına
 * açılıyor — böylece varsayılan görünüm okunabilir kalıyor.
 */
function StaffTable({
  staff,
  actions,
}: {
  staff: AdminStaffMember[];
  actions: {
    updateStaffMember: (profileId: string, input: unknown) => Promise<StaffActionResult>;
    resetStaffPin: (profileId: string, input: unknown) => Promise<StaffActionResult>;
    revealStaffPin: (profileId: string) => Promise<StaffPinRevealResult>;
    regenerateStaffPin: (profileId: string) => Promise<StaffPinRevealResult>;
  };
}) {
  const t = useTranslations("admin.staff");
  const tRole = useTranslations("admin.staff.role");
  const tGrid = useTranslations("admin.table");
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <DataTable
      rows={staff}
      rowKey={(member) => member.id}
      rowAttributes={(member) => ({ "data-testid": `staff-row-${member.id}` })}
      empty={t("empty")}
      searchable
      expandedRow={(member) =>
        editingId !== member.id ? null : (
          <StaffRow
            member={member}
            updateStaffMember={actions.updateStaffMember}
            resetStaffPin={actions.resetStaffPin}
            revealStaffPin={actions.revealStaffPin}
            regenerateStaffPin={actions.regenerateStaffPin}
          />
        )
      }
      columns={[
        {
          key: "name",
          header: t("member.fullName"),
          primary: true,
          value: (member) => member.fullName,
          // Ad yoksa UYDURULMAZ: rozete, o da yoksa role düşülür ve bunun
          // türetilmiş bir etiket olduğu soluk renkle belli edilir.
          cell: (member) =>
            member.fullName ?? (
              <span className="text-[var(--surface-fg-muted)]">{member.badgeNo ?? tRole(member.role)}</span>
            ),
        },
        {
          key: "role",
          header: t("member.role"),
          value: (member) => tRole(member.role),
          cell: (member) => <span className="text-[var(--surface-fg-muted)]">{tRole(member.role)}</span>,
        },
        {
          key: "badge",
          header: t("member.badgeNo"),
          value: (member) => member.badgeNo,
          cell: (member) => <span className="tabular-nums">{member.badgeNo ?? "—"}</span>,
        },
        {
          key: "pin",
          header: t("member.pin"),
          value: (member) => (member.hasPin ? 1 : 0),
          cell: (member) => (
            <Badge variant={member.hasPin ? "secondary" : "destructive"}>
              {member.hasPin ? t("member.pinSet") : t("member.pinNotSet")}
            </Badge>
          ),
        },
        {
          key: "status",
          header: tGrid("status"),
          value: (member) => (member.isActive ? 1 : 0),
          cell: (member) => (
            <Badge variant={member.isActive ? "secondary" : "destructive"}>
              {member.isActive ? t("member.active") : t("member.inactive")}
            </Badge>
          ),
        },
        {
          key: "actions",
          header: tGrid("actions"),
          actions: true,
          align: "end",
          cell: (member) => (
            <DataTableActions>
              <Button
                type="button"
                size="sm"
                variant="outline"
                aria-expanded={editingId === member.id}
                onClick={() => setEditingId((current) => (current === member.id ? null : member.id))}
              >
                {t("member.edit")}
              </Button>
            </DataTableActions>
          ),
        },
      ]}
    />
  );
}

function CreateStaffForm({
  createStaffMember,
}: {
  createStaffMember: (input: unknown) => Promise<StaffActionResult>;
}) {
  const t = useTranslations("admin.staff");
  const tRole = useTranslations("admin.staff.role");
  const tErrors = useTranslations("admin.staff.errors");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const { register, control, handleSubmit, reset } = useForm({
    resolver: standardSchemaResolver(createStaffMemberFormSchema),
    defaultValues: { fullName: "", role: "waiter" as StaffRole, badgeNo: "", pin: "" },
  });

  async function onSubmit(values: { fullName: string; role: StaffRole; badgeNo: string; pin: string }) {
    setError(null);
    const result = await createStaffMember(values);
    if (!result.ok) {
      setError(tErrors(result.error));
      return;
    }
    reset({ fullName: "", role: "waiter", badgeNo: "", pin: "" });
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("create.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="create-full-name">{t("member.fullName")}</Label>
            <Input id="create-full-name" {...register("fullName")} className="w-44" />
          </div>
          <Controller
            control={control}
            name="role"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="w-36" aria-label={t("member.role")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STAFF_MANAGEABLE_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {tRole(r)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <div className="flex flex-col gap-1">
            <Label htmlFor="create-badge-no">{t("member.badgeNo")}</Label>
            <Input id="create-badge-no" {...register("badgeNo")} className="w-32" />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="create-pin">{t("create.pin")}</Label>
            <Input id="create-pin" inputMode="numeric" {...register("pin")} className="w-32" />
          </div>
          <Button type="submit" size="sm">
            {t("create.add")}
          </Button>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </form>
      </CardContent>
    </Card>
  );
}

function DeviceSection({
  branchId,
  devices,
  createStaffDevice,
  revokeStaffDevice,
}: {
  branchId: string;
  devices: AdminStaffDevice[];
  createStaffDevice: (branchId: string, input: unknown) => Promise<DeviceActionResult>;
  revokeStaffDevice: (deviceId: string) => Promise<StaffActionResult>;
}) {
  const t = useTranslations("admin.staff.devices");
  const tGrid = useTranslations("admin.table");
  const tCommon = useTranslations("admin.common");
  const tErrors = useTranslations("admin.staff.errors");
  const locale = useLocale();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
  const { register, handleSubmit, reset } = useForm({
    resolver: standardSchemaResolver(deviceFormSchema),
    defaultValues: { label: "" },
  });

  async function onSubmit(values: { label: string }) {
    setError(null);
    const result = await createStaffDevice(branchId, values);
    if (!result.ok) {
      setError(tErrors(result.error));
      return;
    }
    setRevealedSecret(result.rawSecret);
    reset({ label: "" });
    router.refresh();
  }

  async function handleRevoke(deviceId: string) {
    await revokeStaffDevice(deviceId);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <DataTable
          rows={devices}
          rowKey={(device) => device.id}
          empty={t("empty")}
          initialSort={{ key: "label" }}
          columns={[
            {
              key: "label",
              header: t("label"),
              primary: true,
              value: (device) => device.label,
              cell: (device) => device.label,
            },
            {
              key: "lastSeen",
              header: t("lastSeen"),
              value: (device) => device.lastSeenAt,
              cell: (device) =>
                device.lastSeenAt ? (
                  <span className="text-[var(--surface-fg-muted)] tabular-nums">
                    {new Date(device.lastSeenAt).toLocaleString(locale)}
                  </span>
                ) : (
                  "—"
                ),
            },
            {
              key: "status",
              header: tGrid("status"),
              value: (device) => (device.isActive ? 1 : 0),
              cell: (device) => (
                <Badge variant={device.isActive ? "secondary" : "destructive"}>
                  {device.isActive ? t("active") : t("revoked")}
                </Badge>
              ),
            },
            {
              key: "actions",
              header: tGrid("actions"),
              actions: true,
              align: "end",
              cell: (device) =>
                device.isActive ? (
                  <DataTableActions>
                    <Button type="button" size="sm" variant="outline" onClick={() => handleRevoke(device.id)}>
                      {t("revoke")}
                    </Button>
                  </DataTableActions>
                ) : null,
            },
          ]}
        />

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="device-label">{t("label")}</Label>
            <Input id="device-label" {...register("label")} />
          </div>
          <Button type="submit" size="sm">
            {t("add")}
          </Button>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </form>

        {revealedSecret && (
          <div className="rounded-md border border-border p-3">
            <p className="text-sm font-semibold">{t("secretRevealTitle")}</p>
            <p className="break-all font-mono text-sm">{revealedSecret}</p>
            <p className="text-xs text-destructive">{t("secretWarning")}</p>
            <Button type="button" size="sm" className="mt-2" onClick={() => setRevealedSecret(null)}>
              {tCommon("confirm")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PermissionMatrix({
  matrix,
  updateRolePermission,
}: {
  matrix: RolePermissionMatrix;
  updateRolePermission: (role: StaffRole, permissionKey: PermissionKey, allowed: boolean) => Promise<StaffActionResult>;
}) {
  const t = useTranslations("admin.staff.permissions");
  const tRole = useTranslations("admin.staff.role");
  const router = useRouter();

  async function handleToggle(role: StaffRole, key: PermissionKey, checked: boolean) {
    await updateRolePermission(role, key, checked);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left font-medium"> </th>
                {PERMISSION_MATRIX_ROLES.map((role) => (
                  <th key={role} className="px-2 text-center font-medium">
                    {tRole(role)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERMISSION_KEYS.map((key) => (
                <tr key={key}>
                  <td className="py-1 text-muted-foreground">{t(key.replace(/\./g, "_"))}</td>
                  {PERMISSION_MATRIX_ROLES.map((role) => (
                    <td key={role} className="px-2 text-center">
                      <Switch
                        checked={matrix[role][key]}
                        onCheckedChange={(checked) => handleToggle(role, key, checked)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

export function StaffManager({
  branchId,
  staff,
  devices,
  matrix,
  actions,
}: {
  branchId: string;
  staff: AdminStaffMember[];
  devices: AdminStaffDevice[];
  matrix: RolePermissionMatrix;
  actions: {
    createStaffMember: (input: unknown) => Promise<StaffActionResult>;
    updateStaffMember: (profileId: string, input: unknown) => Promise<StaffActionResult>;
    resetStaffPin: (profileId: string, input: unknown) => Promise<StaffActionResult>;
    revealStaffPin: (profileId: string) => Promise<StaffPinRevealResult>;
    regenerateStaffPin: (profileId: string) => Promise<StaffPinRevealResult>;
    createStaffDevice: (branchId: string, input: unknown) => Promise<DeviceActionResult>;
    revokeStaffDevice: (deviceId: string) => Promise<StaffActionResult>;
    updateRolePermission: (role: StaffRole, permissionKey: PermissionKey, allowed: boolean) => Promise<StaffActionResult>;
  };
}) {
  const t = useTranslations("admin.staff");

  return (
    <div className="flex flex-col gap-8">
      <AdminPageHeader title={t("title")} />

      <StaffTable staff={staff} actions={actions} />

      <CreateStaffForm createStaffMember={actions.createStaffMember} />

      <DeviceSection
        branchId={branchId}
        devices={devices}
        createStaffDevice={actions.createStaffDevice}
        revokeStaffDevice={actions.revokeStaffDevice}
      />

      <PermissionMatrix matrix={matrix} updateRolePermission={actions.updateRolePermission} />
    </div>
  );
}
