-- D87 (bug-hunt 2026-08-01): garson panelinin kendi girişi olmalı, owner
-- çıkışı garsonu düşürmemeli. Kök neden garson ve owner'ın AYNI tarayıcıda
-- aynı Supabase Auth oturumunu (ve dolayısıyla aynı cookie'yi) paylaşmasıydı
-- — garson için ayrı bir hesap oluşturma akışı da yoktu. Çözüm mevcut PIN/
-- cihaz altyapısını (0026/0070, vardiya) panele de genişletir: garson PIN
-- girer, sunucu device+PIN eşleşmesini doğrulayıp o personelin GERÇEK
-- Supabase oturumunu (magic-link mint) AYRI bir cookie adı altında açar
-- (bkz. lib/supabase/waiterClient.ts) — RLS/RPC katmanına hiç dokunulmaz,
-- yalnızca aynı tarayıcıda iki bağımsız oturum saklanır.
--
-- verify_staff_pin_identity: clock_in_or_out'un (0070) doğrulama kısmıyla
-- birebir aynı ama zaman damgası yan etkisi yok ve staff_scheduling
-- modülüne bağımlı değil (panel erişimi vardiya takibinden ayrı bir
-- yetenek).
create or replace function public.verify_staff_pin_identity(p_tenant_id uuid, p_device_id uuid, p_device_secret text, p_pin text)
returns table(profile_id uuid, role text, badge_no text)
language plpgsql
set search_path = public, extensions
as $$
declare
  v_valid_device boolean;
begin
  select exists(
    select 1 from public.staff_devices
    where id = p_device_id and tenant_id = p_tenant_id and is_active = true
      and device_secret_hash = crypt(p_device_secret, device_secret_hash)
  ) into v_valid_device;

  if not v_valid_device then
    raise exception 'invalid device';
  end if;

  return query
  select p.id, p.role, p.badge_no
  from public.profiles p
  where p.tenant_id = p_tenant_id and p.is_active = true
    and p.pin_hash is not null and p.pin_hash = crypt(p_pin, p.pin_hash)
  limit 1;
end;
$$;
revoke all on function public.verify_staff_pin_identity(uuid, uuid, text, text) from public;
grant execute on function public.verify_staff_pin_identity(uuid, uuid, text, text) to service_role;
