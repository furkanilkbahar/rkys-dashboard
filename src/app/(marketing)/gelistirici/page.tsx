import { getTranslations } from "next-intl/server";

import { WEBHOOK_EVENT_TYPES } from "@/lib/webhooks/schemas";

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg border border-border bg-muted p-4 text-xs">
      <code>{children}</code>
    </pre>
  );
}

export default async function DeveloperDocsPage() {
  const t = await getTranslations("developerDocs");

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-10 px-6 py-16">
      <div className="flex flex-col gap-2">
        <h1 className="font-[family-name:var(--font-display)] text-[clamp(1.9rem,3.8vw,2.5rem)] leading-tight font-semibold tracking-[-0.022em]">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">{t("auth.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("auth.body")}</p>
        <CodeBlock>{`curl https://api.rkys.app/api/v1/orders \\
  -H "Authorization: Bearer <API_KEY>"`}</CodeBlock>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">{t("orders.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("orders.body")}</p>
        <CodeBlock>{`GET /api/v1/orders?limit=50

{
  "data": [
    {
      "id": "…",
      "channel": "dine_in",
      "status": "served",
      "subtotalMinor": 15000,
      "createdAt": "2026-07-28T12:00:00Z",
      "items": [
        { "productName": "Türk Kahvesi", "variantName": null, "quantity": 2, "unitPriceMinor": 7500 }
      ]
    }
  ]
}`}</CodeBlock>
        <p className="text-xs text-muted-foreground">{t("orders.limitNote")}</p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">{t("webhooks.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("webhooks.body")}</p>
        <ul className="list-inside list-disc text-sm text-muted-foreground">
          {WEBHOOK_EVENT_TYPES.map((eventType) => (
            <li key={eventType}>
              <code className="text-foreground">{eventType}</code>
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted-foreground">{t("webhooks.deliveryBody")}</p>
        <CodeBlock>{`POST <sizin-webhook-url'iniz>
Content-Type: application/json
X-RKYS-Event: order.created
X-RKYS-Signature: <hmac-sha256-hex>

{ "orderId": "…", "tenantId": "…", … }`}</CodeBlock>
        <p className="text-sm text-muted-foreground">{t("webhooks.verifyBody")}</p>
        <CodeBlock>{`hmac_sha256(payload_json, webhook_secret) === X-RKYS-Signature`}</CodeBlock>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold">{t("management.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("management.body")}</p>
      </section>
    </main>
  );
}
