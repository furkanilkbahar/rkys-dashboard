-- pg_cron tercih edildi (Edge Function cron yerine): Postgres image'ında
-- hazır gelir, self-hosted docker-compose hedefinde (D67) ek bir deploy
-- artifact'i gerektirmez — lokal/staging/prod/self-hosted'da aynı şekilde çalışır.
create extension if not exists pg_cron;

select cron.schedule(
  'close-stale-table-sessions',
  '*/5 * * * *',
  $$select public.close_stale_table_sessions()$$
);
