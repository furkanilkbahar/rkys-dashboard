// RULES/ARCHITECTURE: "Excel uyumlu" ihtiyacı UTF-8 BOM'lu CSV ile
// karşılanır (Excel'in doğrudan doğru kodlamayla açtığı format) — ayrı bir
// xlsx bağımlılığı eklenmez (minimal bağımlılık tercihi, RULES #21).
const BOM = "﻿";

function escapeCsvField(value: string | number): string {
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function toCsv(headers: string[], rows: (string | number)[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(escapeCsvField).join(","));
  return BOM + lines.join("\r\n");
}
