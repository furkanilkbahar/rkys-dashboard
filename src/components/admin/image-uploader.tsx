"use client";

import { useTranslations } from "next-intl";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import type { ImageActionResult } from "@/lib/menu/schemas";

export function ImageUploader({
  currentUrl,
  uploadAction,
  gallery,
  onSelectFromGallery,
}: {
  currentUrl: string | null;
  uploadAction: (formData: FormData) => Promise<ImageActionResult>;
  gallery?: { id: string; url: string }[];
  onSelectFromGallery?: (galleryImageId: string) => Promise<ImageActionResult>;
}) {
  const t = useTranslations("admin.menu.image");
  const tErrors = useTranslations("admin.menu.errors");
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(currentUrl);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showGallery, setShowGallery] = useState(false);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    setIsUploading(true);
    const formData = new FormData();
    formData.set("file", file);

    const result = await uploadAction(formData);
    setIsUploading(false);
    if (event.target) event.target.value = "";

    if (!result.ok) {
      setError(tErrors(result.error));
      return;
    }
    setPreview(result.imageUrl);
    router.refresh();
  }

  async function handleGallerySelect(id: string) {
    if (!onSelectFromGallery) return;
    setError(null);
    const result = await onSelectFromGallery(id);
    if (!result.ok) {
      setError(tErrors(result.error));
      return;
    }
    setPreview(result.imageUrl);
    setShowGallery(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      {preview ? (
        <Image
          src={preview}
          alt=""
          width={160}
          height={160}
          unoptimized
          className="size-40 rounded-md border border-border object-cover"
        />
      ) : (
        <div className="flex size-40 items-center justify-center rounded-md border border-dashed border-border text-xs text-muted-foreground">
          {t("noImage")}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={handleFileChange}
        />
        <Button type="button" size="sm" variant="outline" disabled={isUploading} onClick={() => fileInputRef.current?.click()}>
          {isUploading ? t("uploading") : t("upload")}
        </Button>
        {gallery && gallery.length > 0 && (
          <Button type="button" size="sm" variant="outline" onClick={() => setShowGallery((v) => !v)}>
            {t("chooseFromGallery")}
          </Button>
        )}
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {showGallery && gallery && (
        <div className="grid grid-cols-6 gap-2 rounded-md border border-border p-2">
          {gallery.map((image) => (
            <button
              key={image.id}
              type="button"
              onClick={() => handleGallerySelect(image.id)}
              className="overflow-hidden rounded-md border border-transparent hover:border-primary"
            >
              <Image src={image.url} alt="" width={48} height={48} unoptimized className="size-12 object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
