import { getPublicIncidents } from "@/lib/data/incidents";

import { addIncidentUpdate, createIncident } from "./actions";
import { IncidentsManager } from "./incidents-manager";

export default async function PlatformIncidentsPage() {
  const incidents = await getPublicIncidents();

  return <IncidentsManager incidents={incidents} createIncident={createIncident} addIncidentUpdate={addIncidentUpdate} />;
}
