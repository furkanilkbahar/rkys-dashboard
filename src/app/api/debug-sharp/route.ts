import { readdirSync, existsSync } from "node:fs";
import path from "node:path";

import { NextResponse } from "next/server";

/**
 * Geçici tanı endpoint'i (prod'daki ERR_DLOPEN_FAILED/sharp sorunu için) —
 * kök sebep doğrulanınca silinecek.
 */
export async function GET() {
  const result: Record<string, unknown> = {};

  result.cwd = process.cwd();
  result.dirname = __dirname;
  result.platform = process.platform;
  result.arch = process.arch;

  const candidates = [
    path.join(process.cwd(), "node_modules", "sharp"),
    path.join(process.cwd(), "node_modules", "@img"),
    path.join(__dirname, "node_modules", "sharp"),
    path.join(__dirname, "node_modules", "@img"),
  ];

  result.candidates = candidates.map((p) => ({
    path: p,
    exists: existsSync(p),
    contents: existsSync(p) ? safeReaddir(p) : null,
  }));

  try {
    const sharpPath = require.resolve("sharp");
    result.sharpResolvePath = sharpPath;
  } catch (err) {
    result.sharpResolveError = err instanceof Error ? err.message : String(err);
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- runtime tanı için dinamik require kasıtlı
    const sharp = require("sharp");
    result.sharpVersion = sharp.versions;
  } catch (err) {
    result.sharpRequireError = err instanceof Error ? err.message : String(err);
  }

  return NextResponse.json(result);
}

function safeReaddir(p: string): string[] | string {
  try {
    return readdirSync(p);
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}
