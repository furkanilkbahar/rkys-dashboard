/**
 * TEST ALTYAPISI — ürün yüzeyi değildir.
 *
 * Webhook teslimat testinin (tests/integration/orders/webhooks.integration.test.ts)
 * ihtiyacı olan tek şey, `dispatch_webhook_deliveries`'in POST atabileceği ve
 * kontrollü bir HTTP durumu döndüren bir uç. Eskiden bu `httpbin.org`'du ve
 * servis düştüğünde test ürün hatası yokken kırılıyordu (2026-08-04'te
 * ölçüldü: 15 sn'de HTTP 000).
 *
 * NEDEN EDGE FUNCTION: teslimatı `pg_net` yapıyor, yani istek POSTGRES
 * CONTAINER'ının içinden çıkıyor. Host'taki bir sunucu (`host.docker.internal`)
 * yalnızca Docker Desktop'ta çözülür — CI `ubuntu-latest` üzerinde koşuyor ve
 * orada çözülmez. Kong ise aynı Docker ağında ve her iki ortamda da
 * `http://kong:8000/functions/v1/webhook-test-sink` olarak erişilebilir.
 *
 * `?status=<kod>` ile dönülecek HTTP durumu seçilir (varsayılan 200).
 */
Deno.serve((req: Request) => {
  const status = Number(new URL(req.url).searchParams.get("status") ?? "200");
  return new Response(JSON.stringify({ ok: status < 400, status }), {
    status: Number.isFinite(status) && status >= 100 && status <= 599 ? status : 200,
    headers: { "content-type": "application/json" },
  });
});
