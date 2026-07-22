import "server-only";

import { createClient } from "@/lib/supabase/server";

export type IncidentStatus = "investigating" | "identified" | "monitoring" | "resolved";

export type IncidentUpdate = {
  id: string;
  body: string;
  createdAt: string;
};

export type Incident = {
  id: string;
  title: string;
  status: IncidentStatus;
  startedAt: string;
  resolvedAt: string | null;
  updates: IncidentUpdate[];
};

// incidents_select_all (0043) herkese açık — plans/announcements ile aynı
// desen, service-role'e gerek yok.
export async function getPublicIncidents(): Promise<Incident[]> {
  const supabase = await createClient();
  const [{ data: incidents }, { data: updates }] = await Promise.all([
    supabase.from("incidents").select("id, title, status, started_at, resolved_at").order("started_at", { ascending: false }),
    supabase.from("incident_updates").select("id, incident_id, body, created_at").order("created_at", { ascending: false }),
  ]);

  return (incidents ?? []).map((incident) => ({
    id: incident.id,
    title: incident.title,
    status: incident.status as IncidentStatus,
    startedAt: incident.started_at,
    resolvedAt: incident.resolved_at,
    updates: (updates ?? [])
      .filter((u) => u.incident_id === incident.id)
      .map((u) => ({ id: u.id, body: u.body, createdAt: u.created_at })),
  }));
}

export async function checkSystemStatus(): Promise<"operational" | "degraded"> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("incidents").select("id").limit(1);
    return error ? "degraded" : "operational";
  } catch {
    return "degraded";
  }
}
