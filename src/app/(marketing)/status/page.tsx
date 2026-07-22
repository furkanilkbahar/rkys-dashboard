import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { checkSystemStatus, getPublicIncidents } from "@/lib/data/incidents";

export default async function StatusPage() {
  const t = await getTranslations("status");
  const [systemStatus, incidents] = await Promise.all([checkSystemStatus(), getPublicIncidents()]);
  const activeIncidents = incidents.filter((i) => i.status !== "resolved");
  const resolvedIncidents = incidents.filter((i) => i.status === "resolved");

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 p-8">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <Badge variant={systemStatus === "operational" ? "secondary" : "destructive"}>
          {t(`systemStatus.${systemStatus}`)}
        </Badge>
      </div>

      {activeIncidents.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-base font-semibold">{t("activeIncidentsTitle")}</h2>
          {activeIncidents.map((incident) => (
            <IncidentCard key={incident.id} incident={incident} statusLabel={t(`incidentStatus.${incident.status}`)} />
          ))}
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">{t("historyTitle")}</h2>
        {resolvedIncidents.length === 0 && <p className="text-sm text-muted-foreground">{t("historyEmpty")}</p>}
        {resolvedIncidents.map((incident) => (
          <IncidentCard key={incident.id} incident={incident} statusLabel={t(`incidentStatus.${incident.status}`)} />
        ))}
      </section>
    </main>
  );
}

function IncidentCard({
  incident,
  statusLabel,
}: {
  incident: Awaited<ReturnType<typeof getPublicIncidents>>[number];
  statusLabel: string;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{incident.title}</CardTitle>
          <Badge variant={incident.status === "resolved" ? "secondary" : "outline"}>{statusLabel}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
        {incident.updates.map((update) => (
          <div key={update.id}>
            <p className="text-xs">{new Date(update.createdAt).toLocaleString("tr-TR")}</p>
            <p>{update.body}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
