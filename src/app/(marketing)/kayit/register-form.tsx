"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registerSchema, type RegisterInput } from "@/lib/auth/schemas";

import type { RegisterResult } from "./actions";

export function RegisterForm({ registerTenant }: { registerTenant: (input: unknown) => Promise<RegisterResult> }) {
  const t = useTranslations("registration");
  const [error, setError] = useState<string | null>(null);
  const [slugPreview, setSlugPreview] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: standardSchemaResolver(registerSchema),
    defaultValues: { businessName: "", slug: "", email: "", password: "" },
  });

  async function onSubmit(values: RegisterInput) {
    setError(null);
    const result = await registerTenant(values);
    if (!result.ok) {
      setError(t(`errors.${result.error}`));
      return;
    }
    window.location.assign(result.redirectUrl);
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="businessName">{t("businessName")}</Label>
              <Input id="businessName" {...register("businessName")} />
              {errors.businessName && <p className="text-xs text-destructive">{t("errors.invalid_input")}</p>}
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="slug">{t("slug")}</Label>
              <Input
                id="slug"
                {...register("slug", { onChange: (e) => setSlugPreview(e.target.value) })}
              />
              <p className="text-xs text-muted-foreground">
                {t("slugPreview", { domain: `${slugPreview || "…"}.${process.env.NEXT_PUBLIC_ROOT_DOMAIN}` })}
              </p>
              {errors.slug && (
                <p className="text-xs text-destructive">
                  {t(`errors.${errors.slug.message === "slug_reserved" ? "slug_reserved" : "invalid_slug"}`)}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="email">{t("email")}</Label>
              <Input id="email" type="email" {...register("email")} />
              {errors.email && <p className="text-xs text-destructive">{t("errors.invalid_input")}</p>}
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="password">{t("password")}</Label>
              <Input id="password" type="password" {...register("password")} />
              {errors.password && <p className="text-xs text-destructive">{t("errors.invalid_input")}</p>}
            </div>
            <Button type="submit" disabled={isSubmitting}>
              {t("submit")}
            </Button>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
