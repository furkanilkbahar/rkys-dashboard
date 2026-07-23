// dashboard_widgets.widget_key için sabit katalog (0046) — MODULE_KEYS
// (lib/modules/keys.ts) ile aynı desen: server-only bağımlılığı yok, client
// component'ler (widget seçici, sürükle-bırak listesi) doğrudan import eder.
export const WIDGET_KEYS = [
  "revenue_today",
  "order_count_today",
  "hourly_density",
  "top_products",
  "branch_comparison",
  "anomaly_alerts",
] as const;

export type WidgetKey = (typeof WIDGET_KEYS)[number];
