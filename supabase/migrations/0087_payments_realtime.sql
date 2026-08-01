-- bug-hunt 2026-08-01: masa hesabı hangi ödeme yöntemiyle alındıysa
-- garson tarafına bildirilmesi isteniyor. payments tablosu (0031) hiçbir
-- zaman Realtime publication'a eklenmemişti — RLS zaten SELECT'i doğru
-- scope'a indirger (payments_select: tenant_id = current_tenant_id() and
-- is_staff()), bu yalnızca postgres_changes akışını açar.
alter publication supabase_realtime add table public.payments;
