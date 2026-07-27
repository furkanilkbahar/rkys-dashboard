"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import type { ContactActionResult } from "./actions";

const contactFormSchema = z.object({
  name: z.string().min(1, "required"),
  businessName: z.string(),
  email: z.email(),
  phone: z.string(),
  message: z.string().min(1, "required"),
});
type ContactFormValues = z.input<typeof contactFormSchema>;

export function ContactForm({
  submitContactRequest,
}: {
  submitContactRequest: (input: unknown) => Promise<ContactActionResult>;
}) {
  const t = useTranslations("contact");
  const [status, setStatus] = useState<"idle" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: standardSchemaResolver(contactFormSchema),
    defaultValues: { name: "", businessName: "", email: "", phone: "", message: "" },
  });

  async function onSubmit(values: ContactFormValues) {
    setError(null);
    const result = await submitContactRequest(values);
    if (!result.ok) {
      setError(t("errors.unknown"));
      return;
    }
    reset();
    setStatus("sent");
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </CardHeader>
        <CardContent>
          {status === "sent" ? (
            <p className="text-sm">{t("success")}</p>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <Label htmlFor="name">{t("name")}</Label>
                <Input id="name" {...register("name")} />
                {errors.name && <p className="text-xs text-destructive">{t("errors.invalid_input")}</p>}
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="businessName">{t("businessName")}</Label>
                <Input id="businessName" {...register("businessName")} />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="email">{t("email")}</Label>
                <Input id="email" type="email" {...register("email")} />
                {errors.email && <p className="text-xs text-destructive">{t("errors.invalid_input")}</p>}
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="phone">{t("phone")}</Label>
                <Input id="phone" type="tel" placeholder="05XX XXX XX XX" {...register("phone")} />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="message">{t("message")}</Label>
                <Textarea id="message" rows={4} {...register("message")} />
                {errors.message && <p className="text-xs text-destructive">{t("errors.invalid_input")}</p>}
              </div>
              <Button type="submit" disabled={isSubmitting}>
                {t("submit")}
              </Button>
              {error && <p className="text-sm text-destructive">{error}</p>}
            </form>
          )}
          <div className="mt-4 flex flex-col gap-1 border-t border-border pt-4 text-sm text-muted-foreground">
            <span>
              {t("directEmailLabel")} <a href="mailto:destek@rkys.app" className="hover:text-foreground">destek@rkys.app</a>
            </span>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
