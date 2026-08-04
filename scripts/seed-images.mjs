#!/usr/bin/env node
/**
 * Demo ürün görsellerini Supabase Storage'a yükler ve `products.image_url`'ü
 * doldurur.
 *
 * NEDEN AYRI BİR SCRİPT: seed SQL'i Storage'a dosya yükleyemez. Görseller
 * `supabase/seed/images/` altında repo'da duruyor (hepsi CC0/PDM, bkz.
 * CREDITS.md) ve `supabase db reset` sonrası bu script bir kez koşturulunca
 * demo menü tekrar fotoğraflı hâle gelir.
 *
 * Kullanım:  node scripts/seed-images.mjs
 *
 * YALNIZCA YEREL/DEMO içindir: service-role anahtarını doğrudan kullanır ve
 * yalnızca seed'in sabit ürün id'lerine dokunur. Prod'a karşı çalıştırmayın.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";

const IMAGES_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "supabase", "seed", "images");
const BUCKET = "menu-images";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  // Supabase CLI'ın sabit yerel demo anahtarı (seed.sql'deki password123 ile
  // aynı "yalnızca lokal" deseni).
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

if (!SUPABASE_URL.includes("127.0.0.1") && !SUPABASE_URL.includes("localhost") && !process.env.ALLOW_REMOTE_SEED) {
  console.error("Bu script yerel demo içindir. Uzak bir Supabase'e yazmak için ALLOW_REMOTE_SEED=1 verin.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

/** `201.jpg` → seed'in sabit ürün UUID'si. */
function productIdFromFile(file) {
  const shortId = file.replace(/\.jpg$/i, "");
  if (!/^\d{3}$/.test(shortId)) return null;
  return `00000000-0000-4000-8000-000000000${shortId}`;
}

/**
 * Onboarding demo şablonlarının görselleri (`_templates/<sablon>/<slug>.webp`).
 * Bunlar TENANT'A AİT DEĞİL — "Demo veriyle keşfet" yolunu seçen HER yeni
 * işletmenin menüsü bu paylaşılan yollara işaret eder
 * (`menuTemplateImagePath`, onboarding/actions.ts). Production'da zaten
 * yüklüydüler; `supabase db reset` yerel Storage'ı sildiği için burada da
 * geri yüklenmeleri gerekiyordu, aksi halde yerelde demo menü kırık
 * görsellerle açılıyordu.
 */
async function uploadTemplates() {
  const root = join(IMAGES_DIR, "_templates");
  if (!existsSync(root)) return 0;
  let count = 0;
  for (const templateKey of readdirSync(root)) {
    const dir = join(root, templateKey);
    for (const file of readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".webp"))) {
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(`_templates/${templateKey}/${file}`, readFileSync(join(dir, file)), {
          contentType: "image/webp",
          upsert: true,
        });
      if (error) console.error(`HATA: _templates/${templateKey}/${file} → ${error.message}`);
      else count += 1;
    }
  }
  return count;
}

const templateCount = await uploadTemplates();

const files = readdirSync(IMAGES_DIR).filter((f) => f.toLowerCase().endsWith(".jpg"));
let uploaded = 0;
let skipped = 0;

for (const file of files) {
  const productId = productIdFromFile(file);
  if (!productId) continue;

  const { data: product } = await supabase
    .from("products")
    .select("id, tenant_id")
    .eq("id", productId)
    .maybeSingle();

  if (!product) {
    console.warn(`atlandı: ${file} → ürün bulunamadı (${productId})`);
    skipped += 1;
    continue;
  }

  const storagePath = `${product.tenant_id}/products/${productId}.jpg`;
  const body = readFileSync(join(IMAGES_DIR, file));

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, body, { contentType: "image/jpeg", upsert: true });

  if (uploadError) {
    console.error(`HATA: ${file} → ${uploadError.message}`);
    skipped += 1;
    continue;
  }

  const publicUrl = supabase.storage.from(BUCKET).getPublicUrl(storagePath).data.publicUrl;
  const { error: updateError } = await supabase
    .from("products")
    .update({ image_url: publicUrl })
    .eq("id", productId);

  if (updateError) {
    console.error(`HATA: ${file} image_url yazılamadı → ${updateError.message}`);
    skipped += 1;
    continue;
  }

  uploaded += 1;
}

console.log(`Demo görselleri: ${uploaded} ürün + ${templateCount} onboarding şablonu yüklendi, ${skipped} atlandı.`);
