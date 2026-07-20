-- Bug fix: table_session_devices'ın önceki SELECT politikası misafiri
-- yalnızca KENDİ cihaz satırıyla sınırlıyordu (guest_user_id = auth.uid()).
-- D24 "cihaz bazlı etiket" aynı masadaki TÜM siparişlerin hangi cihazdan
-- geldiğini göstermeyi gerektirir (müşteri oturum görünümü, Adım 7) — aynı
-- table_session'daki diğer cihazların etiketini görememek bu özelliği
-- kırıyordu (order_items'ta cihaz adı "?" olarak kalıyordu).
drop policy "table_session_devices_select" on public.table_session_devices;
create policy "table_session_devices_select" on public.table_session_devices for select
  using (
    (tenant_id = public.current_tenant_id() and public.is_staff())
    or table_session_id = public.current_table_session_id()
  );
