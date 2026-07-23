import "server-only";

import { WIDGET_KEYS, type WidgetKey } from "@/lib/analytics/widgets";
import { createClient } from "@/lib/supabase/server";

export type WidgetLayoutItem = { widgetKey: WidgetKey; position: number; isVisible: boolean };

function isWidgetKey(value: string): value is WidgetKey {
  return (WIDGET_KEYS as readonly string[]).includes(value);
}

// Kullanıcının hiç kaydı yoksa (ilk açılış) katalogdaki tüm widget'lar
// varsayılan sırayla + görünür döner — kişiselleştirme yalnızca kullanıcı
// bir kez sürükleyip bıraktığında veya bir widget'ı gizlediğinde satır alır.
export async function getDashboardWidgetLayout(userId: string): Promise<WidgetLayoutItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("dashboard_widgets")
    .select("widget_key, position, is_visible")
    .eq("user_id", userId)
    .order("position");

  const stored = new Map(
    (data ?? []).filter((row) => isWidgetKey(row.widget_key)).map((row) => [row.widget_key as WidgetKey, row]),
  );

  const known = WIDGET_KEYS.filter((key) => stored.has(key)).sort(
    (a, b) => stored.get(a)!.position - stored.get(b)!.position,
  );
  const unknown = WIDGET_KEYS.filter((key) => !stored.has(key));
  const orderedKeys = [...known, ...unknown];

  return orderedKeys.map((key, index) => {
    const row = stored.get(key);
    return { widgetKey: key, position: index, isVisible: row?.is_visible ?? true };
  });
}

export async function saveDashboardWidgetOrder(tenantId: string, userId: string, orderedKeys: WidgetKey[]): Promise<void> {
  const supabase = await createClient();
  const existing = await getDashboardWidgetLayout(userId);
  const visibilityByKey = new Map(existing.map((item) => [item.widgetKey, item.isVisible]));

  await supabase.from("dashboard_widgets").upsert(
    orderedKeys.map((widgetKey, index) => ({
      tenant_id: tenantId,
      user_id: userId,
      widget_key: widgetKey,
      position: index,
      is_visible: visibilityByKey.get(widgetKey) ?? true,
    })),
    { onConflict: "user_id,widget_key" },
  );
}

export async function setDashboardWidgetVisibility(
  tenantId: string,
  userId: string,
  widgetKey: WidgetKey,
  isVisible: boolean,
): Promise<void> {
  const supabase = await createClient();
  const existing = await getDashboardWidgetLayout(userId);
  const current = existing.find((item) => item.widgetKey === widgetKey);

  await supabase.from("dashboard_widgets").upsert(
    {
      tenant_id: tenantId,
      user_id: userId,
      widget_key: widgetKey,
      position: current?.position ?? existing.length,
      is_visible: isVisible,
    },
    { onConflict: "user_id,widget_key" },
  );
}
