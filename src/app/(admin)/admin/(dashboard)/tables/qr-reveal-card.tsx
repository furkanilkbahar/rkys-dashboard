"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import QRCode from "qrcode";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function QrRevealCard({
  label,
  guestPath,
  onClose,
}: {
  label: string;
  guestPath: string;
  onClose: () => void;
}) {
  const t = useTranslations("admin.tables.qr");
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  // Bu bileşen yalnızca bir form submit sonrası client-side state
  // güncellemesiyle mount edilir (hiçbir zaman SSR edilmez), bu yüzden
  // window render sırasında güvenle okunabilir — effect'e gerek yok.
  const fullUrl = `${window.location.origin}${guestPath}`;

  useEffect(() => {
    QRCode.toDataURL(fullUrl, { width: 320, margin: 2 }).then(setDataUrl);
  }, [fullUrl]);

  function handleDownload() {
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `qr-${label.replace(/\s+/g, "-").toLowerCase()}.png`;
    a.click();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 print:static print:bg-transparent print:p-0">
      <Card className="w-full max-w-sm print:w-auto print:border-none print:shadow-none">
        <CardHeader>
          <CardTitle>{label}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          {dataUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- data URL, next/image optimizasyonuna gerek yok
            <img src={dataUrl} alt={label} className="size-64" />
          )}
          <p className="break-all text-center text-xs text-muted-foreground">{fullUrl}</p>
          <p className="text-center text-xs text-destructive print:hidden">{t("oneTimeWarning")}</p>
          <div className="flex gap-2 print:hidden">
            <Button type="button" variant="outline" size="sm" onClick={handleDownload}>
              {t("download")}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => window.print()}>
              {t("print")}
            </Button>
            <Button type="button" size="sm" onClick={onClose}>
              {t("close")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
