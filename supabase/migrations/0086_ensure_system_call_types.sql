-- bug-hunt 2026-08-01: "Hesap İste" (ve "Su İstiyorum"/"Yardım İstiyorum")
-- her zaman "invalid call type" ile başarısız oluyordu. Kök neden:
-- call_waiter RPC'si (0020) sabit 'water'/'check'/'assistance' key'lerine
-- göre call_types satırı arıyor, ama hiçbir tenant-oluşturma akışı
-- (kayit/actions.ts) bu satırları hiç oluşturmuyordu — yalnızca admin
-- ayarlarından elle eklenen call type'lar var (settings/actions.ts, key
-- her zaman randomUUID()). seed.sql'in acme/beta/gamma'yı elle bu key'lerle
-- doldurması bu boşluğu yalnızca local dev'de gizliyordu.
--
-- ensure_system_call_types: idempotent (on conflict do nothing), sabit
-- id KULLANMAZ — seed.sql'in kendi sabit-id'li acme/beta/gamma satırlarıyla
-- (0020/0086 öncesi) çakışmaması için var olan (tenant_id, key) korunur.
create or replace function public.ensure_system_call_types(p_tenant_id uuid)
returns void
language plpgsql
as $$
begin
  insert into public.call_types (tenant_id, key, is_system, display_order)
  values
    (p_tenant_id, 'water', true, 0),
    (p_tenant_id, 'check', true, 1),
    (p_tenant_id, 'assistance', true, 2)
  on conflict (tenant_id, key) do nothing;

  insert into public.content_translations (tenant_id, entity_type, entity_id, locale, field, value)
  select p_tenant_id, 'call_type', ct.id, tr.locale, 'name', tr.value
  from public.call_types ct
  cross join (
    values
      ('water', 'tr', 'Su İstiyorum'), ('water', 'en', 'Water, please'),
      ('check', 'tr', 'Hesap İstiyorum'), ('check', 'en', 'Check, please'),
      ('assistance', 'tr', 'Yardım İstiyorum'), ('assistance', 'en', 'I need help')
  ) as tr(key, locale, value)
  where ct.tenant_id = p_tenant_id and ct.key = tr.key and ct.is_system
  on conflict (entity_type, entity_id, locale, field) do nothing;
end;
$$;
revoke all on function public.ensure_system_call_types(uuid) from public;
grant execute on function public.ensure_system_call_types(uuid) to service_role;

-- Backfill: bu migration'dan önce oluşturulmuş her tenant (yerel seed
-- dahil, prod Supabase Cloud'a uygulandığında oradaki gerçek tenant'lar
-- dahil) eksik sistem call type'larını alır.
select public.ensure_system_call_types(id) from public.tenants;
