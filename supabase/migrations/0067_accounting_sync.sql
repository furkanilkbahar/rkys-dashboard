-- Faz 10 Adım 3 (S44): Muhasebe API adaptörü (D61) — kayıt (ledger) deseni.
--
-- Kapsam kararı (Varsayım): senkronizasyon birimi ÖDEME değil SİPARİŞ'tir
-- — bir sipariş 'served' (hizmet tamamlandı) durumuna geçtiğinde muhasebe
-- sistemine bir "fatura satırı" olarak gönderilebilir hale gelir. Bu,
-- webhook'ların order.created/order.status_changed olay modeliyle ve
-- RULES #18'in "fiyat siparişe kopyalanır" ilkesiyle tutarlıdır — ayrı bir
-- fatura/kalem tablosu icat edilmez, orders zaten kaynak veridir.
--
-- accounting_sync_log: cash_movements/webhook_deliveries ile aynı append-
-- only ledger deseni — bir siparişin birden fazla senkronizasyon denemesi
-- olabilir (başarısız olup tekrar denenmiş), bu yüzden UNIQUE(order_id)
-- YOK; "senkronize mi" sorusu en son 'success' satırının varlığından okunur.
create table public.accounting_sync_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  provider text not null,
  status text not null check (status in ('success', 'failed')),
  external_ref text,
  error_message text,
  synced_at timestamptz not null default now()
);
create index idx_accounting_sync_log_tenant on public.accounting_sync_log(tenant_id);
create index idx_accounting_sync_log_order on public.accounting_sync_log(order_id);

alter table public.accounting_sync_log enable row level security;
create policy "accounting_sync_log_staff" on public.accounting_sync_log for all
  using (tenant_id = public.current_tenant_id() and public.is_staff())
  with check (tenant_id = public.current_tenant_id() and public.is_staff());
grant select, insert on public.accounting_sync_log to authenticated, service_role;
