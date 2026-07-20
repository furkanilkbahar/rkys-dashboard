-- Garson paneli/KDS/müşteri oturumu canlı güncellemeleri (D30) için Realtime
-- publication'a eklenir — RLS zaten SELECT'i doğru scope'a indirger, bu
-- yalnızca postgres_changes akışını açar.
alter publication supabase_realtime add table
  public.orders, public.order_items, public.waiter_calls, public.table_sessions;
