/**
 * "Bugün" (business date) hesaplaması tenant saat dilimine göre yapılmalı —
 * sunucunun UTC günüyle tenant'ın yerel günü ~günün belirli saatlerinde
 * farklılaşır (bkz. reports/page.tsx todayIso ile aynı gerekçe/desen).
 */
export function todayIsoInTimezone(timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date());
}

/** "YYYY-MM-DD" tarihine gün ekler/çıkarır (negatif değer = geriye doğru). */
export function addDaysToIsoDate(dateIso: string, days: number): string {
  const [year, month, day] = dateIso.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return shifted.toISOString().slice(0, 10);
}

/**
 * <input type="datetime-local"> değeri ("YYYY-MM-DDTHH:mm") saat dilimi
 * taşımaz — bir misafirin "restoranda saat 19:00" gibi bir YEREL duvar
 * saati seçimini temsil eder. new Date(value).toISOString() bunu TARAYICININ
 * yerel saat dilimiyle yorumlar; tarayıcı tenant'ın saat diliminden farklıysa
 * (yurt dışından erişim, yanlış sistem saati vb.) yanlış UTC ana kaydedilir.
 * Bu, "tahmin et ve düzelt" (guess-and-correct) tekniğiyle duvar saatini
 * DOĞRUDAN hedef saat dilimindeki UTC anına çevirir (harici kütüphane yok).
 */
export function zonedWallTimeToUtcIso(wallTime: string, timeZone: string): string {
  const [datePart, timePart] = wallTime.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = (timePart ?? "00:00").split(":").map(Number);

  const naiveUtcMs = Date.UTC(year, month - 1, day, hour, minute);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(naiveUtcMs));

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtcMs = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  const offsetMs = asUtcMs - naiveUtcMs;

  return new Date(naiveUtcMs - offsetMs).toISOString();
}
