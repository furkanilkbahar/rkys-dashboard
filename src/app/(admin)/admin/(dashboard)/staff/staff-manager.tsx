"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
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
} from "@/lib/staff/schemas";

const PERMISSION_MATRIX_ROLES: StaffRole[] = ["manager", "waiter", "kitchen", "courier"];

function StaffRow({
  member,
  updateStaffMember,
  resetStaffPin,
}: {
  member: AdminStaffMember;
  updateStaffMember: (profileId: string, input: unknown) => Promise<StaffActionResult>;
  resetStaffPin: (profileId: string, input: unknown) => Promise<StaffActionResult>;
}) {
  const t = useTranslations("admin.staff");
  const tRole = useTranslations("admin.staff.role");
  const tErrors = useTranslations("admin.staff.errors");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [showPinForm, setShowPinForm] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);

  const { register, control, handleSubmit } = useForm({
    resolver: standardSchemaResolver(staffUpdateFormSchema),
    defaultValues: { role: member.role, badgeNo: member.badgeNo ?? "", isActive: member.isActive },
  });

  const pinForm = useForm({
    resolver: standardSchemaResolver(pinResetFormSchema),
    defaultValues: { pin: "" },
  });

  async function onSubmit(values: { role: StaffRole; badgeNo: string; isActive: boolean }) {
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
    <div className="flex flex-col gap-2 rounded-md border border-border p-3">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-wrap items-end gap-3">
        <Controller
          control={control}
          name="role"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger className="w-36">
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
        <Badge variant="secondary">{member.hasPin ? t("member.pinSet") : t("member.pinNotSet")}</Badge>
        <Button type="submit" size="sm">
          {t("member.save")}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setShowPinForm((v) => !v)}>
          {t("member.resetPin")}
        </Button>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </form>

      {showPinForm && (
        <form onSubmit={pinForm.handleSubmit(onPinSubmit)} className="flex items-end gap-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor={`new-pin-${member.id}`}>{t("member.newPin")}</Label>
            <Input id={`new-pin-${member.id}`} inputMode="numeric" {...pinForm.register("pin")} className="w-40" />
          </div>
          <Button type="submit" size="sm" variant="outline">
            {t("member.resetPin")}
          </Button>
          {pinError && <p className="text-xs text-destructive">{pinError}</p>}
        </form>
      )}
    </div>
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
    defaultValues: { role: "waiter" as StaffRole, badgeNo: "", pin: "" },
  });

  async function onSubmit(values: { role: StaffRole; badgeNo: string; pin: string }) {
    setError(null);
    const result = await createStaffMember(values);
    if (!result.ok) {
      setError(tErrors(result.error));
      return;
    }
    reset({ role: "waiter", badgeNo: "", pin: "" });
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("create.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-wrap items-end gap-3">
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
  const tCommon = useTranslations("admin.common");
  const tErrors = useTranslations("admin.staff.errors");
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
        {devices.length === 0 && <p className="text-sm text-muted-foreground">{t("empty")}</p>}
        {devices.map((device) => (
          <div key={device.id} className="flex items-center justify-between gap-2 text-sm">
            <span>{device.label}</span>
            <div className="flex items-center gap-2">
              <Badge variant={device.isActive ? "secondary" : "destructive"}>
                {device.isActive ? t("active") : t("revoked")}
              </Badge>
              {device.isActive && (
                <Button type="button" size="sm" variant="outline" onClick={() => handleRevoke(device.id)}>
                  {t("revoke")}
                </Button>
              )}
            </div>
          </div>
        ))}

        <form onSubmit={handleSubmit(onSubmit)} className="flex items-end gap-2">
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
    createStaffDevice: (branchId: string, input: unknown) => Promise<DeviceActionResult>;
    revokeStaffDevice: (deviceId: string) => Promise<StaffActionResult>;
    updateRolePermission: (role: StaffRole, permissionKey: PermissionKey, allowed: boolean) => Promise<StaffActionResult>;
  };
}) {
  const t = useTranslations("admin.staff");

  return (
    <div className="flex flex-col gap-8">
      <AdminPageHeader title={t("title")} />

      <div className="flex flex-col gap-3">
        {staff.map((member) => (
          <StaffRow
            key={member.id}
            member={member}
            updateStaffMember={actions.updateStaffMember}
            resetStaffPin={actions.resetStaffPin}
          />
        ))}
      </div>

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
